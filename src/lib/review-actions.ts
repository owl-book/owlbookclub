"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction, logAdminActions } from "@/lib/admin-log";
import { db } from "@/lib/db";
import { imageType } from "@/lib/image-shrink";
import { isMeetingArt } from "@/lib/meeting-art";
import { PHOTO_BUCKET } from "@/lib/meetings";
import { isGuOf, isSido } from "@/lib/regions";
import { isFormat, isGenre } from "@/lib/tags";

// 승인 대기 화면의 동작. 모든 동작은 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).
// 할 수 있는 일은 '공개하기', '대기함에서 빼기', '승인 전에 고치기'뿐이다. 지우는 기능은 없다.
// - 모임 승인: 그 모임(묶음이면 같은 묶음의 대기 회차 모두)을 공개. 책방도 대기 중이면 함께 공개
// - 넣지 않음: 대기에서만 빼고 숨김은 그대로 둔다(책방 단위로 모두 넣지 않음도 같다)
// - 책방 승인: 책방만 공개(모임은 따로 승인)

const REVIEW_PATH = "/admin/review";

// 승인 전에 화면이 고친 내용을 먼저 저장했으면(ApproveForm) 완료 안내에 함께 알린다
function savedParam(formData: FormData): string {
  return formData.get("saved") === "1" ? "&saved=1" : "";
}

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
  redirect(`${REVIEW_PATH}?done=approve&n=${ids.length}${storeToo ? "&store=1" : ""}${savedParam(formData)}`);
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
  redirect(`${REVIEW_PATH}?done=approve&n=${ids.length}${storeToo ? "&store=1" : ""}${savedParam(formData)}`);
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
  redirect(`${REVIEW_PATH}?done=store${savedParam(formData)}`);
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

  // 표지 그림: 'auto' 면 자동(비움), 'photo' 면 대표 사진(0035), 아니면 그림 이름(0029)
  const art = formData.get("coverArt");
  if (art !== "auto" && art !== "photo" && !isMeetingArt(art)) return { error: "잘못된 요청입니다." };
  const photo = await savePhoto(id, art === "photo", formData.get("photo"));
  if ("error" in photo) return { error: photo.error };

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
    // 사진을 고르면 그림 고르기는 그대로 둔다(사진이 먼저 보이고, 사진을 빼면 예전 고른 그림으로 돌아간다)
    ...(art === "photo" ? {} : { cover_art: art === "auto" ? null : art }),
    ...photo.changes,
  };
  const { error } = await db().from("meetings").update(changes).eq("id", before.id).eq("pending_review", true);
  if (error) {
    console.error("[owl] review edit failed", error.message);
    if (photo.uploaded) await db().storage.from(PHOTO_BUCKET).remove([photo.uploaded]);
    return { error: SAVE_FAILED };
  }
  // 바꾸거나 뺀 예전 사진 파일은 보관함에서 정리한다(실패해도 화면에는 영향 없음)
  if (photo.old) await db().storage.from(PHOTO_BUCKET).remove([photo.old]);
  await logAdminAction({ type: "meeting", id }, "edit", { pending_review: true, ...(photo.old ? { photo_path: photo.old } : {}) }, changes);
}

// ── 같은 모임 한꺼번에 고치기·승인 (이름이 같고 날짜만 다른 대기 모임들) ──
// 화면(BulkEditForm)은 바꾼 칸만 보낸다. 보내지 않은 칸은 모임마다 원래 값 그대로 둔다.
// 날짜는 모임마다 그대로 두고, 시각을 바꾸면 각 모임의 날짜에 그 시각을 붙인다

type BulkRow = { id: number; store_id: number; starts_at: string; ends_at: string | null };

// 고른 모임이 모두 아직 대기 중이고 한 책방의 모임인지 확인하고 읽는다
async function readBulk(formData: FormData): Promise<BulkRow[] | { error: string }> {
  const ids = [...new Set(formData.getAll("ids").map(toId))];
  if (ids.length === 0) return { error: "바꿀 모임을 하나 이상 골라 주세요." };
  if (ids.length > 60 || ids.some((id) => id === null)) return { error: "잘못된 요청입니다." };
  const { data, error } = await db().from("meetings").select("id, store_id, starts_at, ends_at, pending_review").in("id", ids as number[]);
  if (error) throw new Error(error.message);
  const rows = data as (BulkRow & { pending_review: boolean })[];
  if (rows.length !== ids.length || rows.some((r) => !r.pending_review)) return { error: "이미 처리한 모임이 있어요. 화면을 새로 고쳐 주세요." };
  if (new Set(rows.map((r) => r.store_id)).size > 1) return { error: "잘못된 요청입니다." };
  return rows;
}

const TIME_RE = /^\d{2}:\d{2}$/;

function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function bulkEditPendingMeetings(formData: FormData): Promise<EditResult> {
  await requireAdmin();
  const result = await tryEdit(() => saveBulk(formData));
  if (!result) revalidatePath(REVIEW_PATH);
  return result;
}

async function saveBulk(formData: FormData): Promise<EditResult> {
  const rows = await readBulk(formData);
  if ("error" in rows) return rows;
  const has = (k: string) => formData.has(k);

  // 모든 모임에 똑같이 들어갈 칸
  const common: Record<string, unknown> = {};
  if (has("title")) {
    const title = text(formData, "title", 100);
    if (!title) return { error: "모임 이름을 적어 주세요." };
    common.title = title.replace(/·/g, "~"); // 제목 글꼴에 가운뎃점이 없어 빈칸으로 보인다
  }
  if (has("genre")) {
    if (!isGenre(formData.get("genre"))) return { error: "잘못된 요청입니다." };
    common.tag_genre = formData.get("genre");
  }
  if (has("format")) {
    if (!isFormat(formData.get("format"))) return { error: "잘못된 요청입니다." };
    common.tag_format = formData.get("format");
  }
  if (has("cadence")) {
    const v = formData.get("cadence");
    if (v !== "정기" && v !== "일일") return { error: "잘못된 요청입니다." };
    common.tag_cadence = v;
  }
  if (has("status")) {
    const v = formData.get("status");
    if (v !== "open" && v !== "closed") return { error: "잘못된 요청입니다." };
    common.status = v;
  }
  if (has("applyMethod")) {
    const v = formData.get("applyMethod");
    if (v !== "form" && v !== "dm" && v !== "none") return { error: "잘못된 요청입니다." };
    common.apply_method = v;
  }
  if (has("applyUrl")) {
    const raw = text(formData, "applyUrl", 500);
    const applyUrl = !raw ? "" : /^sms:/i.test(raw) ? `sms:${raw.slice(4).replace(/[^\d+]/g, "")}` : raw;
    if (applyUrl && !URL_RE.test(applyUrl) && !SMS_RE.test(applyUrl)) return { error: "신청 링크는 https:// 로 시작하는 주소나 sms:01012345678 처럼 적어 주세요." };
    common.apply_url = applyUrl;
  }
  if (has("postUrl")) {
    const postUrl = text(formData, "postUrl", 500);
    if (postUrl && !URL_RE.test(postUrl)) return { error: "게시물 링크는 https:// 로 시작하는 주소로 적어 주세요." };
    common.post_url = postUrl;
  }
  const texts: [string, string, number][] = [
    ["timeNote", "time_note", 60],
    ["bookTitle", "book_title_text", 200],
    ["bookAuthor", "book_author_text", 100],
    ["feeText", "fee_text", 100],
    ["place", "place", 200],
    ["description", "description", 1000],
  ];
  for (const [key, col, max] of texts) if (has(key)) common[col] = text(formData, key, max);

  const art = has("coverArt") || has("photo") ? (formData.get("coverArt") ?? "photo") : null;
  if (art !== null && art !== "auto" && art !== "photo" && !isMeetingArt(art)) return { error: "잘못된 요청입니다." };

  // 시각: 각 모임의 날짜에 새 시각을 붙인다. 끝나는 시각은 시작보다 늦어야 한다
  const startTime = has("startTime") ? text(formData, "startTime", 5) : null;
  const endTime = has("endTime") ? text(formData, "endTime", 5) : null;
  if ((startTime && !TIME_RE.test(startTime)) || (endTime && !TIME_RE.test(endTime))) return { error: "시각을 확인해 주세요." };
  if (has("startTime") && !startTime) return { error: "시작 시각은 비울 수 없어요." };
  const perRow = new Map<number, Record<string, unknown>>();
  for (const r of rows) {
    const day = kstDay(r.starts_at);
    const start = startTime ? new Date(`${day}T${startTime}:00+09:00`) : new Date(r.starts_at);
    const end = has("endTime") ? (endTime ? new Date(`${day}T${endTime}:00+09:00`) : null) : r.ends_at ? new Date(r.ends_at) : null;
    if (end && end.getTime() <= start.getTime()) return { error: "끝나는 시각은 시작 시각보다 늦어야 해요." };
    const times: Record<string, unknown> = {};
    if (startTime) times.starts_at = start.toISOString();
    if (has("endTime")) times.ends_at = end?.toISOString() ?? null;
    perRow.set(r.id, times);
  }

  if (art === null && Object.keys(common).length === 0 && !startTime && !has("endTime")) return; // 바꾼 칸이 없다

  // 대표 사진은 모임마다 따로 올린다(한 파일을 함께 쓰면 한 모임에서 사진을 뺄 때 다른 모임 사진까지 지워져서)
  const photos = new Map<number, Extract<PhotoResult, { changes: unknown }>>();
  if (art !== null) {
    for (const r of rows) {
      const photo = await savePhoto(r.id, art === "photo", formData.get("photo"));
      if ("error" in photo) {
        const uploaded = [...photos.values()].flatMap((p) => (p.uploaded ? [p.uploaded] : []));
        if (uploaded.length) await db().storage.from(PHOTO_BUCKET).remove(uploaded);
        return { error: photo.error };
      }
      photos.set(r.id, photo);
    }
  }

  const done: { id: number; changes: Record<string, unknown>; old?: string }[] = [];
  for (const r of rows) {
    const photo = photos.get(r.id);
    const changes = {
      ...common,
      ...perRow.get(r.id),
      ...(art === null || art === "photo" ? {} : { cover_art: art === "auto" ? null : art }),
      ...photo?.changes,
    };
    const { error } = await db().from("meetings").update(changes).eq("id", r.id).eq("pending_review", true);
    if (error) {
      console.error("[owl] bulk edit failed", error.message);
      // 아직 저장하지 못한 모임에 올린 사진은 정리한다(이미 저장한 모임은 그대로 둔다)
      const left = rows.filter((x) => !done.some((d) => d.id === x.id)).flatMap((x) => (photos.get(x.id)?.uploaded ? [photos.get(x.id)!.uploaded!] : []));
      if (left.length) await db().storage.from(PHOTO_BUCKET).remove(left);
      await logBulk(done);
      return { error: done.length ? `${done.length}개만 고치고 멈췄어요. 잠시 뒤 다시 눌러 주세요.` : SAVE_FAILED };
    }
    done.push({ id: r.id, changes, old: photo?.old });
  }
  const old = done.flatMap((d) => (d.old ? [d.old] : []));
  if (old.length) await db().storage.from(PHOTO_BUCKET).remove(old);
  await logBulk(done);
}

async function logBulk(done: { id: number; changes: Record<string, unknown>; old?: string }[]) {
  await logAdminActions(
    done.map((d) => ({ target: { type: "meeting" as const, id: d.id }, action: "edit" as const, before: { pending_review: true, ...(d.old ? { photo_path: d.old } : {}) }, after: d.changes })),
  );
}

// 고른 모임만 승인(같은 모임 묶음의 [고친 내용으로 N개 승인]). 책방도 대기 중이면 함께 공개
export async function approveMeetings(formData: FormData) {
  await requireAdmin();
  const rows = await readBulk(formData);
  if ("error" in rows) throw new Error(rows.error);
  const ids = rows.map((r) => r.id);
  if (await missingApplyLink(ids)) fail(`m-${ids[0]}`, "nolink-all");
  const storeToo = await approveIds(ids, rows[0].store_id);
  revalidatePath("/", "layout");
  redirect(`${REVIEW_PATH}?done=approve&n=${ids.length}${storeToo ? "&store=1" : ""}${savedParam(formData)}`);
}

const PHOTO_MAX_BYTES = 1024 * 1024; // 화면에서 가로 480px 로 줄여 보내므로 넉넉하다(보관함 제한 0035 와 같은 값)

type PhotoResult = { error: string } | { changes: { photo_path?: string | null }; uploaded?: string; old?: string };

// 대표 사진(0035): 사진 칸을 고르고 새 사진이 있으면 올리고, 다른 그림을 고르면 있던 사진을 뺀다.
// 바꿀 때마다 새 이름으로 올린다: 같은 이름이면 휴대폰·CDN 에 예전 사진이 남을 수 있어서
async function savePhoto(id: number, usePhoto: boolean, file: FormDataEntryValue | null): Promise<PhotoResult> {
  // 0035 실행 전에는 칸이 없다: 오류를 내지 않고 사진이 없는 것으로 본다
  const { data } = await db().from("meetings").select("photo_path").eq("id", id).maybeSingle();
  const current = (data as { photo_path: string | null } | null)?.photo_path ?? null;
  const picked = file instanceof File && file.size > 0 ? file : null;

  if (!usePhoto) return current ? { changes: { photo_path: null }, old: current } : { changes: {} };
  if (!picked) return current ? { changes: {} } : { error: "올릴 사진을 골라 주세요." };
  if (picked.size > PHOTO_MAX_BYTES) return { error: "사진이 너무 커요. 다른 사진으로 다시 골라 주세요." };

  const bytes = new Uint8Array(await picked.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "JPG, PNG, WEBP 사진만 올릴 수 있어요." };
  const path = `${id}/${crypto.randomUUID()}.${type.ext}`;
  const uploaded = await db().storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000" });
  if (uploaded.error) return { error: `사진을 올리지 못했어요. (${uploaded.error.message})` };
  return { changes: { photo_path: path }, uploaded: path, old: current ?? undefined };
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
