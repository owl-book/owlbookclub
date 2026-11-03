"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-log";
import { db } from "@/lib/db";
import { POSTER_BUCKET, isExhibitionKind } from "@/lib/exhibitions";
import { imageType } from "@/lib/image-shrink";
import type { EditResult } from "@/lib/review-actions";

// 승인 대기 화면의 전시 동작. 모든 동작은 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).
// 할 수 있는 일은 '공개하기', '대기함에서 빼기', '승인 전에 고치기', '포스터 올리기·바꾸기'뿐이다. 지우는 기능은 없다.
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
  await logAdminAction({ type: "exhibition", id }, "approve", { is_hidden: true, pending_review: true }, { is_hidden: false, pending_review: false });
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
  await logAdminAction({ type: "exhibition", id }, "reject", { is_hidden: true, pending_review: true }, { is_hidden: true, pending_review: false });
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
  await logAdminAction({ type: "exhibition", id }, "upload", { poster_path: before.poster_path }, { poster_path: path, poster_width: width, poster_height: height });

  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?done=${before.poster_path ? "ex-poster-replace" : "ex-poster"}#e-${id}`);
}

// ── 대기 중인 전시 고치기 (승인 전에만. 공개된 것은 고치지 않는다) ──

const URL_RE = /^https?:\/\/\S+$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAVE_FAILED = "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.";
const EDIT_FIELDS = "title, kind, artist, starts_on, ends_on, hours_note, is_paid, fee_note, intro, post_url, review_note";

function text(formData: FormData, key: string, max: number): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n").trim();
  if (s.length > max) throw new Error(`${max}자까지 적을 수 있어요.`);
  return s || null;
}

// 실패하면 이유를 돌려주고(화면이 고치던 내용을 그대로 둔 채 보여 줌), 성공하면 비워 돌려준다. 목록으로 돌아가는 일은 화면(EditForm)이 한다
export async function editPendingExhibition(formData: FormData): Promise<EditResult> {
  await requireAdmin();
  const id = toId(formData.get("exhibitionId"));
  if (!id) return { error: "잘못된 요청입니다." };
  try {
    const result = await saveExhibition(id, formData);
    if (!result) revalidatePath(REVIEW_PATH);
    return result;
  } catch (e) {
    console.error("[owl] exhibition edit failed", e);
    return { error: e instanceof Error && e.message ? e.message : SAVE_FAILED };
  }
}

async function saveExhibition(id: number, formData: FormData): Promise<EditResult> {
  const title = text(formData, "title", 120);
  if (!title) return { error: "전시 이름을 적어 주세요." };
  const kind = formData.get("kind");
  if (!isExhibitionKind(kind)) return { error: "잘못된 요청입니다." };
  const startsOn = formData.get("startsOn");
  const endsOn = formData.get("endsOn");
  if (typeof startsOn !== "string" || !DATE_RE.test(startsOn) || typeof endsOn !== "string" || !DATE_RE.test(endsOn)) return { error: "시작일과 마지막 날을 골라 주세요." };
  if (endsOn < startsOn) return { error: "마지막 날이 시작일보다 앞이에요." };
  const postUrl = text(formData, "postUrl", 500);
  if (postUrl && !URL_RE.test(postUrl)) return { error: "게시물 링크는 https:// 로 시작하는 주소로 적어 주세요." };
  const isPaid = formData.get("isPaid") === "yes";

  // 바꾸기 전 값도 함께 읽어 처리 기록에 남긴다
  const cur = await db().from("exhibitions").select(EDIT_FIELDS).eq("id", id).eq("pending_review", true).maybeSingle();
  if (cur.error) {
    console.error("[owl] exhibition edit failed", cur.error.message);
    return { error: SAVE_FAILED };
  }
  if (!cur.data) return { error: "이미 처리한 전시예요. 화면을 새로 고쳐 주세요." };

  const changes = {
    title,
    kind,
    artist: text(formData, "artist", 120),
    starts_on: startsOn,
    ends_on: endsOn,
    hours_note: text(formData, "hoursNote", 200),
    is_paid: isPaid,
    // 무료면 금액은 비운다(화면에 안 보이는 값이 남지 않게)
    fee_note: isPaid ? text(formData, "feeNote", 60) : null,
    intro: text(formData, "intro", 2000),
    post_url: postUrl,
    review_note: text(formData, "note", 1000),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("exhibitions").update(changes).eq("id", id).eq("pending_review", true).select("id");
  if (error) {
    console.error("[owl] exhibition edit failed", error.message);
    return { error: SAVE_FAILED };
  }
  if (!data?.length) return { error: "이미 처리한 전시예요. 화면을 새로 고쳐 주세요." };
  await logAdminAction({ type: "exhibition", id }, "edit", cur.data as Record<string, unknown>, changes);
}
