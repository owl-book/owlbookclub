"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-log";
import { db } from "@/lib/db";
import { imageType } from "@/lib/image-shrink";
import { PHOTO_BUCKET } from "@/lib/meetings";

// 승인 대기 화면의 모임 대표 사진 올리기·바꾸기·빼기(0035). 승인 전 모임에만 할 수 있다.
// 묶음 모임도 회차마다 따로 올린다. 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).

const REVIEW_PATH = "/admin/review";
const MAX_BYTES = 1024 * 1024; // 화면에서 가로 480px 로 줄여 보내므로 넉넉하다(보관함 제한 0035 와 같은 값)

function toId(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// 화면이 다시 그려질 때 카드 위치로 돌아가게, 묶음이면 묶음 대표 카드(cardId)로 보낸다
function back(done: string, formData: FormData, id: number): never {
  const cardId = toId(formData.get("cardId")) ?? id;
  redirect(`${REVIEW_PATH}?done=${done}#m-${cardId}`);
}

async function readPending(id: number): Promise<{ photo_path: string | null }> {
  const { data, error } = await db().from("meetings").select("photo_path, pending_review").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("모임을 찾을 수 없어요.");
  const r = data as { photo_path: string | null; pending_review: boolean };
  if (!r.pending_review) throw new Error("이미 처리한 모임이에요. 화면을 새로 고쳐 주세요.");
  return r;
}

export type PhotoUploadState = { error?: string } | undefined;

// 바꿀 때마다 새 이름으로 올린다: 같은 이름이면 휴대폰·CDN 에 예전 사진이 남을 수 있어서
export async function uploadMeetingPhoto(_prev: PhotoUploadState, formData: FormData): Promise<PhotoUploadState> {
  await requireAdmin();
  const id = toId(formData.get("meetingId"));
  const file = formData.get("image");
  if (!id) return { error: "모임 번호가 없어요. 화면을 새로 고친 뒤 다시 해 주세요." };
  if (!(file instanceof File) || file.size === 0) return { error: "올릴 사진을 골라 주세요." };
  if (file.size > MAX_BYTES) return { error: "사진이 너무 커요. 다른 사진으로 다시 골라 주세요." };

  let before: { photo_path: string | null };
  try {
    before = await readPending(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "모임을 찾을 수 없어요." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "JPG, PNG, WEBP 사진만 올릴 수 있어요." };

  const path = `${id}/${crypto.randomUUID()}.${type.ext}`;
  const uploaded = await db().storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000" });
  if (uploaded.error) return { error: `사진을 올리지 못했어요. (${uploaded.error.message})` };

  const saved = await db().from("meetings").update({ photo_path: path }).eq("id", id).eq("pending_review", true);
  if (saved.error) {
    await db().storage.from(PHOTO_BUCKET).remove([path]);
    return { error: `사진 정보를 저장하지 못했어요. (${saved.error.message})` };
  }
  // 바꾼 경우 예전 파일은 보관함에서 정리한다(실패해도 화면에는 영향 없음)
  if (before.photo_path && before.photo_path !== path) await db().storage.from(PHOTO_BUCKET).remove([before.photo_path]);
  await logAdminAction({ type: "meeting", id }, "upload", { photo_path: before.photo_path }, { photo_path: path });

  revalidatePath(REVIEW_PATH);
  back(before.photo_path ? "photo-replace" : "photo", formData, id);
}

// 사진 빼기: 다시 고른 그림·책 표지로 보인다
export async function removeMeetingPhoto(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("meetingId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  const before = await readPending(id);
  if (!before.photo_path) back("photo-remove", formData, id);

  const { error } = await db().from("meetings").update({ photo_path: null }).eq("id", id).eq("pending_review", true);
  if (error) throw new Error(error.message);
  await db().storage.from(PHOTO_BUCKET).remove([before.photo_path]);
  await logAdminAction({ type: "meeting", id }, "remove", { photo_path: before.photo_path }, { photo_path: null });

  revalidatePath(REVIEW_PATH);
  back("photo-remove", formData, id);
}
