"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { POSTER_BUCKET } from "@/lib/exhibitions";
import { imageType } from "@/lib/image-shrink";

// 승인 대기 화면의 전시 동작. 모든 동작은 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).
// 할 수 있는 일은 '공개하기', '대기함에서 빼기', '포스터 올리기·바꾸기'뿐이다. 지우는 기능은 없다.
// 포스터가 있는 전시는 '책방에 포스터 사용 허가를 받았어요'에 표시해야 공개된다.

const REVIEW_PATH = "/admin/review";
const MAX_BYTES = 2 * 1024 * 1024; // 화면에서 긴 쪽 1600px 로 줄여 보내므로 넉넉하다(보관함 제한 0024 와 같은 값)

function toId(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

type PendingRow = { id: number; store_id: number; poster_path: string | null; pending_review: boolean; store: { is_blocked: boolean } };

async function readPending(id: number): Promise<PendingRow> {
  const { data, error } = await db().from("exhibitions").select("id, store_id, poster_path, pending_review, store:stores!inner(is_blocked)").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("전시를 찾을 수 없습니다.");
  const r = data as unknown as PendingRow;
  if (!r.pending_review) throw new Error("이미 처리한 전시예요. 화면을 새로 고쳐 주세요.");
  return r;
}

function fail(id: number, error: string): never {
  redirect(`${REVIEW_PATH}?error=${error}#e-${id}`);
}

export async function approveExhibition(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("exhibitionId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  const r = await readPending(id);
  // 포스터는 책방 허가를 받은 뒤에만 공개한다
  if (r.poster_path && formData.get("permission") !== "yes") fail(id, "ex-permission");
  // 책방이 아직 공개 전이면 전시 화면이 보이지 않으므로 책방(모임)부터 승인하게 한다
  if (r.store.is_blocked) fail(id, "ex-store");
  const { error } = await db().from("exhibitions").update({ is_hidden: false, pending_review: false, updated_at: new Date().toISOString() }).eq("id", id).eq("pending_review", true);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`${REVIEW_PATH}?done=ex-approve`);
}

// 넣지 않음: 대기에서만 빼고 숨김은 그대로 둔다(지우지 않는다)
export async function rejectExhibition(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("exhibitionId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  await readPending(id);
  const { error } = await db().from("exhibitions").update({ pending_review: false, updated_at: new Date().toISOString() }).eq("id", id).eq("pending_review", true);
  if (error) throw new Error(error.message);
  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?done=ex-reject`);
}

export type PosterUploadState = { error?: string } | undefined;

// 포스터 올리기·바꾸기(승인 전에만). 바꿀 때마다 새 이름으로 올린다: 같은 이름이면 휴대폰·CDN 에 예전 사진이 남을 수 있어서
export async function uploadExhibitionPoster(_prev: PosterUploadState, formData: FormData): Promise<PosterUploadState> {
  await requireAdmin();
  const id = toId(formData.get("exhibitionId"));
  const file = formData.get("image");
  const width = toId(formData.get("width"));
  const height = toId(formData.get("height"));
  if (!id) return { error: "전시 번호가 없어요. 화면을 새로 고친 뒤 다시 해 주세요." };
  if (!(file instanceof File) || file.size === 0) return { error: "올릴 포스터를 골라 주세요." };
  if (file.size > MAX_BYTES) return { error: "사진이 너무 커요. 다른 사진으로 다시 골라 주세요." };

  let before: PendingRow;
  try {
    before = await readPending(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "전시를 찾을 수 없어요." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "JPG, PNG, WEBP 사진만 올릴 수 있어요." };

  const path = `${id}/${crypto.randomUUID()}.${type.ext}`;
  const uploaded = await db().storage.from(POSTER_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000" });
  if (uploaded.error) return { error: `포스터를 올리지 못했어요. (${uploaded.error.message})` };

  const saved = await db()
    .from("exhibitions")
    .update({ poster_path: path, poster_width: width, poster_height: height, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (saved.error) {
    await db().storage.from(POSTER_BUCKET).remove([path]);
    return { error: `포스터 정보를 저장하지 못했어요. (${saved.error.message})` };
  }
  // 바꾼 경우 예전 파일은 보관함에서 정리한다(실패해도 화면에는 영향 없음)
  if (before.poster_path && before.poster_path !== path) await db().storage.from(POSTER_BUCKET).remove([before.poster_path]);

  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?done=${before.poster_path ? "ex-poster-replace" : "ex-poster"}#e-${id}`);
}
