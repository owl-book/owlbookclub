"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction, logAdminActions } from "@/lib/admin-log";
import { db } from "@/lib/db";
import { isMeetingArt } from "@/lib/meeting-art";
import { isGuOf, isSido } from "@/lib/regions";
import { isFormat, isGenre } from "@/lib/tags";

// 승인 대기 화면의 동작. 모든 동작은 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).
// 할 수 있는 일은 '공개하기', '대기함에서 빼기', '승인 전에 고치기'뿐이다. 지우는 기능은 없다.
// - 모임 승인: 그 모임(묶음이면 같은 묶음의 대기 회차 모두)을 공개. 책방도 대기 중이면 함께 공개
// - 넣지 않음: 대기에서만 빼고 숨김은 그대로 둔다(책방 단위로 모두 넣지 않음도 같다)
// - 책방 승인: 책방만 공개(모임은 따로 승인)

const REVIEW_PATH = "/admin/review";

function toId(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

type PendingRow = { id: number; store_id: number; series_key: string | null; is_hidden: boolean; pending_review: boolean; tag_genre: string; tag_format: string };

async function readPending(id: number): Promise<PendingRow> {
  const { data, error } = await db().from("meetings").select("id, store_id, series_key, is_hidden, pending_review, tag_genre, tag_format").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("모임을 찾을 수 없습니다.");
  const r = data as PendingRow;
  if (!r.pending_review) throw new Error("이미 처리한 모임이에요. 화면을 새로 고쳐 주세요.");
  return r;
}

// 같은 묶음의 대기 회차까지 함께 고른다(일괄 신청 모임은 회차 일부만 공개하면 '한 번에 신청'이 어긋나서)
async function withSeries(r: PendingRow): Promise<number[]> {
  if (!r.series_key?.trim()) return [r.id];
  const { data, error } = await db().from("meetings").select("id").eq("series_key", r.series_key).eq("store_id", r.store_id).eq("pending_review", true);
  if (error) throw new Error(error.message);
  return [...new Set([r.id, ...(data as { id: number }[]).map((x) => x.id)])];
}

async function log(ids: number[], action: "approve" | "reject", after: Record<string, unknown>) {
  await logAdminActions(ids.map((id) => ({ target: { type: "meeting", id }, action, before: { is_hidden: true, pending_review: true }, after })));
}

async function approveStoreRow(storeId: number): Promise<boolean> {
  const { data, error } = await db()
    .from("stores")
    .update({ is_blocked: false, pending_review: false })
    .eq("id", storeId)
    .eq("pending_review", true)
    .select("id");
  if (error) throw new Error(error.message);
  const approved = (data ?? []).length > 0;
  if (approved) await logAdminAction({ type: "store", id: storeId }, "approve", { is_blocked: true, pending_review: true }, { is_blocked: false, pending_review: false });
  return approved;
}

// 신청 링크가 빈 모임은 공개하지 않는다(신청 버튼이 아무 데도 안 가서). 빈 모임이 하나라도 있으면 true
async function missingApplyLink(ids: number[]): Promise<boolean> {
  const { data, error } = await db().from("meetings").select("id, apply_url").in("id", ids);
  if (error) throw new Error(error.message);
  return (data as { apply_url: string | null }[]).some((r) => !r.apply_url?.trim());
}

async function approveIds(ids: number[], storeId: number): Promise<boolean> {
  const { error } = await db().from("meetings").update({ is_hidden: false, pending_review: false }).in("id", ids).eq("pending_review", true);
  if (error) throw new Error(error.message);
  await log(ids, "approve", { is_hidden: false, pending_review: false });
  // 책방이 아직 대기 중이면 모임만 공개해도 보이지 않으므로 함께 공개한다
  return approveStoreRow(storeId);
}

export async function approveMeeting(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("meetingId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  const r = await readPending(id);
  const ids = await withSeries(r);
  if (await missingApplyLink(ids)) fail(`m-${id}`, "nolink");
  const storeToo = await approveIds(ids, r.store_id);
  revalidatePath("/", "layout");
  redirect(`${REVIEW_PATH}?done=approve&n=${ids.length}${storeToo ? "&store=1" : ""}`);
}

export async function rejectMeeting(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("meetingId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  const r = await readPending(id);
  const ids = await withSeries(r);
  const { error } = await db().from("meetings").update({ pending_review: false }).in("id", ids).eq("pending_review", true);
  if (error) throw new Error(error.message);
  await log(ids, "reject", { is_hidden: true, pending_review: false });
  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?done=reject&n=${ids.length}`);
}

// 이 책방의 대기 모임 모두 승인(책방도 대기 중이면 함께)
export async function approveStoreAll(formData: FormData) {
  await requireAdmin();
  const storeId = toId(formData.get("storeId"));
  if (!storeId) throw new Error("잘못된 요청입니다.");
  const { data, error } = await db().from("meetings").select("id").eq("store_id", storeId).eq("pending_review", true);
  if (error) throw new Error(error.message);
  const ids = (data as { id: number }[]).map((x) => x.id);
  if (ids.length > 0 && (await missingApplyLink(ids))) fail(`store-${storeId}`, "nolink-all");
  const storeToo = ids.length > 0 ? await approveIds(ids, storeId) : await approveStoreRow(storeId);
  revalidatePath("/", "layout");
  redirect(`${REVIEW_PATH}?done=approve&n=${ids.length}${storeToo ? "&store=1" : ""}`);
}

// 이 책방의 대기 모임 모두 넣지 않음(숨김은 그대로, 책방 대기도 그대로)
export async function rejectStoreAll(formData: FormData) {
  await requireAdmin();
  const storeId = toId(formData.get("storeId"));
  if (!storeId) throw new Error("잘못된 요청입니다.");
  const { data, error } = await db().from("meetings").update({ pending_review: false }).eq("store_id", storeId).eq("pending_review", true).select("id");
  if (error) throw new Error(error.message);
  const ids = (data as { id: number }[]).map((x) => x.id);
  if (ids.length > 0) await log(ids, "reject", { is_hidden: true, pending_review: false });
  revalidatePath(REVIEW_PATH);
  redirect(`${REVIEW_PATH}?done=reject&n=${ids.length}`);
}

// 책방만 공개(모임은 아직 대기)
export async function approveStore(formData: FormData) {
  await requireAdmin();
  const storeId = toId(formData.get("storeId"));
  if (!storeId) throw new Error("잘못된 요청입니다.");
  await approveStoreRow(storeId);
  revalidatePath("/", "layout");
  redirect(`${REVIEW_PATH}?done=store`);
}

// ── 대기 중인 모임·책방 고치기 (승인 전에만. 공개된 것은 고치지 않는다) ──

const URL_RE = /^https?:\/\/\S+$/i;
const SMS_RE = /^sms:\+?\d{9,13}$/i;

function text(formData: FormData, key: string, max: number): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n").trim();
  if (s.length > max) throw new Error(`${max}자까지 적을 수 있어요.`);
  return s || null;
}

function fail(id: string, error: string): never {
  redirect(`${REVIEW_PATH}?error=${error}#${id}`);
}

// 고치기 결과: 실패하면 이유를 돌려주고(화면이 고치던 내용을 그대로 둔 채 폼 아래에 보여 줌), 성공하면 비워 돌려준다.
// 성공 뒤 목록으로 돌아가는 일은 화면(EditForm)이 한다. 여기서 redirect 하면 화면 쪽에는 오류로 전해진다
export type EditResult = { error: string } | undefined;

const SAVE_FAILED = "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.";

// 고치는 도중 생긴 문제(글자 수 초과·이미 공개됨·DB 오류)를 오류 화면으로 넘기지 않고 이유로 바꿔 돌려준다
async function tryEdit(save: () => Promise<EditResult>): Promise<EditResult> {
  try {
    return await save();
  } catch (e) {
    console.error("[owl] review edit failed", e);
    return { error: e instanceof Error && e.message ? e.message : SAVE_FAILED };
  }
}

export async function editPendingMeeting(formData: FormData): Promise<EditResult> {
  await requireAdmin();
  const id = toId(formData.get("meetingId"));
  if (!id) return { error: "잘못된 요청입니다." };
  const result = await tryEdit(() => saveMeeting(id, formData));
  if (!result) revalidatePath(REVIEW_PATH);
  return result;
}

async function saveMeeting(id: number, formData: FormData): Promise<EditResult> {
  const before = await readPending(id);

  const startsRaw = formData.get("startsAt");
  if (typeof startsRaw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsRaw)) return { error: "날짜와 시작 시각을 확인해 주세요." };
  const startsAt = new Date(`${startsRaw}:00+09:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "날짜와 시작 시각을 확인해 주세요." };

  // 끝나는 시각은 같은 날 '21:00'처럼 받는다. 비우면 없음
  const endsRaw = text(formData, "endsAt", 5);
  let endsAt: Date | null = null;
  if (endsRaw) {
    if (!/^\d{2}:\d{2}$/.test(endsRaw)) return { error: "끝나는 시각은 시작 시각보다 늦어야 해요(같은 날 '21:00'처럼)." };
    endsAt = new Date(`${startsRaw.slice(0, 10)}T${endsRaw}:00+09:00`);
    if (endsAt.getTime() <= startsAt.getTime()) return { error: "끝나는 시각은 시작 시각보다 늦어야 해요(같은 날 '21:00'처럼)." };
  }

  const title = text(formData, "title", 100);
  if (!title) return { error: "모임 이름을 적어 주세요." };

  const genre = formData.get("genre");
  const format = formData.get("format");
  const cadence = formData.get("cadence");
  const status = formData.get("status");
  const method = formData.get("applyMethod");
  // 목록에 없는 예전 값은 그대로 두는 것만 허락한다
  const genreOk = isGenre(genre) || genre === before.tag_genre;
  const formatOk = isFormat(format) || format === before.tag_format;
  if (!genreOk || !formatOk || typeof genre !== "string" || typeof format !== "string" || (cadence !== "정기" && cadence !== "일일") || (status !== "open" && status !== "closed") || (method !== "form" && method !== "dm" && method !== "none"))
    return { error: "잘못된 요청입니다." };

  // 신청 링크는 비워 둘 수 있다(승인할 때 막는다). 적으면 https:// 또는 sms:01012345678
  const applyRaw = text(formData, "applyUrl", 500);
  const applyUrl = !applyRaw ? "" : /^sms:/i.test(applyRaw) ? `sms:${applyRaw.slice(4).replace(/[^\d+]/g, "")}` : applyRaw;
  if (applyUrl && !URL_RE.test(applyUrl) && !SMS_RE.test(applyUrl)) return { error: "신청 링크는 https:// 로 시작하는 주소나 sms:01012345678 처럼 적어 주세요." };
  const postUrl = text(formData, "postUrl", 500);
  if (postUrl && !URL_RE.test(postUrl)) return { error: "게시물 링크는 https:// 로 시작하는 주소로 적어 주세요." };

  // 표지 그림: 'auto' 면 자동(비움), 아니면 그림 이름(0029)
  const art = formData.get("coverArt");
  if (art !== "auto" && !isMeetingArt(art)) return { error: "잘못된 요청입니다." };

  const changes = {
    title: title.replace(/·/g, "~"), // 제목 글꼴에 가운뎃점이 없어 빈칸으로 보인다
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    time_note: text(formData, "timeNote", 60),
    tag_genre: genre,
    tag_format: format,
    tag_cadence: cadence,
    status,
    apply_method: method,
    apply_url: applyUrl,
    post_url: postUrl,
    book_title_text: text(formData, "bookTitle", 200),
    book_author_text: text(formData, "bookAuthor", 100),
    fee_text: text(formData, "feeText", 100),
    place: text(formData, "place", 200),
    description: text(formData, "description", 1000),
    review_note: text(formData, "note", 1000),
    cover_art: art === "auto" ? null : art,
  };
  const { error } = await db().from("meetings").update(changes).eq("id", before.id).eq("pending_review", true);
  if (error) {
    console.error("[owl] review edit failed", error.message);
    return { error: SAVE_FAILED };
  }
  await logAdminAction({ type: "meeting", id }, "edit", { pending_review: true }, changes);
}

const STORE_EDIT_FIELDS = "name, region, address, hours, phone, instagram_url, intro, review_note";

export async function editPendingStore(formData: FormData): Promise<EditResult> {
  await requireAdmin();
  const id = toId(formData.get("storeId"));
  if (!id) return { error: "잘못된 요청입니다." };
  const result = await tryEdit(() => saveStore(id, formData));
  if (!result) revalidatePath(REVIEW_PATH);
  return result;
}

async function saveStore(id: number, formData: FormData): Promise<EditResult> {
  const name = text(formData, "name", 60);
  if (!name) return { error: "책방 이름을 적어 주세요." };
  // 바꾸기 전 값도 함께 읽어 처리 기록에 남긴다
  const cur = await db().from("stores").select(STORE_EDIT_FIELDS).eq("id", id).eq("pending_review", true).maybeSingle();
  if (cur.error) {
    console.error("[owl] review edit failed", cur.error.message);
    return { error: SAVE_FAILED };
  }
  if (!cur.data) return { error: "이미 공개된 책방이에요. 화면을 새로 고쳐 주세요." };
  const region = formData.get("region");
  const [sido, gu] = typeof region === "string" ? region.split(" ") : [];
  const regionOk = (isSido(sido) && isGuOf(sido, gu)) || region === (cur.data as { region: string }).region;
  if (!regionOk || typeof region !== "string") return { error: "잘못된 요청입니다." };
  const instagram = text(formData, "instagramUrl", 300);
  if (instagram && !URL_RE.test(instagram)) return { error: "인스타그램은 https:// 로 시작하는 주소로 적어 주세요." };

  const changes = {
    name,
    region,
    address: text(formData, "address", 200),
    hours: text(formData, "hours", 300),
    phone: text(formData, "phone", 30),
    instagram_url: instagram,
    intro: text(formData, "intro", 1000),
    review_note: text(formData, "note", 1000),
  };
  const { data, error } = await db().from("stores").update(changes).eq("id", id).eq("pending_review", true).select("id");
  if (error) {
    console.error("[owl] review edit failed", error.message);
    return { error: SAVE_FAILED };
  }
  if (!data?.length) return { error: "이미 공개된 책방이에요. 화면을 새로 고쳐 주세요." };
  await logAdminAction({ type: "store", id }, "edit", cur.data as Record<string, unknown>, changes);
}
