import "server-only";
import { cache } from "react";
import { db, hasDb } from "@/lib/db";
import { demoMeetings } from "@/lib/meetings";
import { dayKey, kstDayNumber } from "@/lib/time";

// 책방 전시 소식(0024). 책방 안에서 여는 그림·사진 전시, 그림책 원화전, 팝업·굿즈 행사.
// 작품 사진은 싣지 않고 포스터 한 장만 쓴다: 작품은 책방에 가서 보도록.
// 날짜는 시각 없이 한국 날짜("2026-10-22")로만 다룬다. 마지막 날(ends_on)까지 '지금 하는 전시'다.

export const EXHIBITION_KINDS = ["전시", "원화전", "팝업"] as const;
export type ExhibitionKind = (typeof EXHIBITION_KINDS)[number];

// 화면에 보이는 이름. DB 값은 짧게 두고(엑셀에 적기 쉽게) 보여 줄 때만 풀어 쓴다
export const KIND_LABEL: Record<ExhibitionKind, string> = { 전시: "그림·사진 전시", 원화전: "그림책 원화전", 팝업: "팝업·굿즈" };

export function isExhibitionKind(v: unknown): v is ExhibitionKind {
  return typeof v === "string" && (EXHIBITION_KINDS as readonly string[]).includes(v);
}

export const POSTER_BUCKET = "exhibition-posters";

export type Poster = { url: string; width: number | null; height: number | null };

export type Exhibition = {
  id: number;
  title: string;
  kind: ExhibitionKind;
  artist: string | null;
  startsOn: string; // "2026-10-20"
  endsOn: string;
  hoursNote: string | null;
  isPaid: boolean;
  feeNote: string | null;
  intro: string | null;
  postUrl: string | null;
  poster: Poster | null;
  hidden: boolean;
  store: { id: number; name: string; region: string };
};

export type ExhibitionPhase = "now" | "soon" | "past";

const SELECT = "*, store:stores!inner(id, name, region, is_blocked)";

export type ExhibitionRow = {
  id: number;
  title: string;
  kind: string;
  artist: string | null;
  starts_on: string;
  ends_on: string;
  hours_note: string | null;
  is_paid: boolean;
  fee_note: string | null;
  intro: string | null;
  post_url: string | null;
  poster_path: string | null;
  poster_width: number | null;
  poster_height: number | null;
  is_hidden: boolean;
  review_note?: string | null;
  store: { id: number; name: string; region: string; is_blocked: boolean };
};

export function posterPublicUrl(path: string): string {
  return db().storage.from(POSTER_BUCKET).getPublicUrl(path).data.publicUrl;
}

function webUrl(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s && /^https?:\/\//i.test(s) ? s : null;
}

export function exhibitionFromRow(r: ExhibitionRow): Exhibition {
  const t = (v: string | null | undefined) => v?.trim() || null;
  return {
    id: r.id,
    title: r.title.trim(),
    kind: isExhibitionKind(r.kind) ? r.kind : "전시",
    artist: t(r.artist),
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    hoursNote: t(r.hours_note),
    isPaid: r.is_paid,
    feeNote: t(r.fee_note),
    intro: t(r.intro),
    postUrl: webUrl(r.post_url),
    poster: r.poster_path ? { url: posterPublicUrl(r.poster_path), width: r.poster_width, height: r.poster_height } : null,
    hidden: r.is_hidden,
    store: { id: r.store.id, name: r.store.name, region: r.store.region },
  };
}

// 오늘(한국 날짜) 기준 전시 단계
export function todayKey(now = new Date()): string {
  return dayKey(kstDayNumber(now));
}

export function exhibitionPhase(e: Pick<Exhibition, "startsOn" | "endsOn">, now = new Date()): ExhibitionPhase {
  const today = todayKey(now);
  if (e.endsOn < today) return "past";
  return e.startsOn > today ? "soon" : "now";
}

// 지금 하는 전시는 끝나는 날이 가까운 것부터(곧 끝나는 걸 먼저 보여 줘야 가 볼 마음이 든다),
// 곧 열리는 전시는 시작일 순, 지난 전시는 최근에 끝난 것부터
export function groupExhibitions(list: Exhibition[], now = new Date()): Record<ExhibitionPhase, Exhibition[]> {
  const by = (key: "startsOn" | "endsOn", dir: 1 | -1) => (a: Exhibition, b: Exhibition) => dir * a[key].localeCompare(b[key]) || a.id - b.id;
  const of = (p: ExhibitionPhase) => list.filter((e) => exhibitionPhase(e, now) === p);
  return {
    now: of("now").sort(by("endsOn", 1)),
    soon: of("soon").sort(by("startsOn", 1)),
    past: of("past").sort(by("endsOn", -1)),
  };
}

// 표(0024)가 아직 없을 때도 화면은 떠야 하므로, 읽기 오류는 '전시 없음'으로 본다
function rowsOrEmpty(res: { data: unknown; error: { message: string } | null }, what: string): ExhibitionRow[] {
  if (res.error) {
    console.error(`[owl] ${what} failed`, res.error.message);
    return [];
  }
  return (res.data ?? []) as ExhibitionRow[];
}

// 공개 전시 전부(지난 전시 포함). 숨긴 전시·게재 차단 책방의 전시는 뺀다
export const listExhibitions = cache(async function listExhibitions(): Promise<Exhibition[]> {
  if (!hasDb()) return demoExhibitions(new Date());
  const res = await db().from("exhibitions").select(SELECT).eq("is_hidden", false).eq("store.is_blocked", false).order("ends_on", { ascending: false }).limit(500);
  return rowsOrEmpty(res, "exhibitions read").map(exhibitionFromRow);
});

export const getExhibition = cache(async function getExhibition(id: number): Promise<Exhibition | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!hasDb()) return demoExhibitions(new Date()).find((e) => e.id === id) ?? null;
  const res = await db().from("exhibitions").select(SELECT).eq("id", id).eq("is_hidden", false).eq("store.is_blocked", false).limit(1);
  const row = rowsOrEmpty(res, "exhibition read")[0];
  return row ? exhibitionFromRow(row) : null;
});

// 책방 화면: 이 책방의 지금 하는·곧 열리는 전시
export async function getStoreExhibitions(storeId: number, now = new Date()): Promise<Exhibition[]> {
  const all = (await listExhibitions()).filter((e) => e.store.id === storeId);
  const g = groupExhibitions(all, now);
  return [...g.now, ...g.soon];
}

// 책방 모아보기 카드의 '전시 중' 표시: 오늘 전시를 하고 있는 책방 번호
export async function getStoreIdsShowingNow(now = new Date()): Promise<Set<number>> {
  return new Set((await listExhibitions()).filter((e) => exhibitionPhase(e, now) === "now").map((e) => e.store.id));
}

// ── DB 연결 전 로컬 미리보기용 ──
// 포스터 자리 확인용 그림(3:4). 실제 포스터는 운영자 화면에서 올린다
const DEMO_POSTER: Poster = {
  url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="#e9e2d3"/><rect x="60" y="60" width="480" height="520" fill="#5a6b8c"/><circle cx="420" cy="200" r="70" fill="#edb93a"/><text x="60" y="680" font-size="56" font-family="sans-serif" fill="#16181c">골목의 오후</text><text x="60" y="740" font-size="28" font-family="sans-serif" fill="#4e545c">필름 사진전</text></svg>')}`,
  width: 600,
  height: 800,
};
function demoExhibitions(now: Date): Exhibition[] {
  const seen = new Map<number, { id: number; name: string; region: string }>();
  for (const m of demoMeetings(now)) seen.set(m.store.id, m.store);
  const stores = [...seen.values()];
  if (stores.length === 0) return [];
  const day = (offset: number) => dayKey(kstDayNumber(now) + offset);
  const at = (i: number) => stores[i % stores.length];
  const base = { hoursNote: null, isPaid: false, feeNote: null, postUrl: "https://www.instagram.com/", poster: null, hidden: false };
  return [
    { ...base, id: 1, title: "작은 새들의 겨울 원화전", kind: "원화전", artist: "김지은", startsOn: day(-10), endsOn: day(3), intro: "그림책 『작은 새들의 겨울』 원화 24점을 책방 2층에 걸었어요.\n작가님이 직접 고른 스케치도 함께 볼 수 있어요.", store: at(0) },
    { ...base, id: 2, title: "골목의 오후, 필름 사진전", kind: "전시", artist: "박하늘", startsOn: day(-3), endsOn: day(25), intro: "동네 골목을 3년 동안 필름으로 담았어요.", poster: DEMO_POSTER, store: at(1) },
    { ...base, id: 3, title: "손바닥 문구 팝업", kind: "팝업", artist: "종이상점", startsOn: day(6), endsOn: day(8), isPaid: true, feeNote: "5,000원 (음료 포함)", hoursNote: "주말만 오후 1시 ~ 6시", intro: "직접 만든 엽서와 스티커를 팔아요.", store: at(2) },
    { ...base, id: 4, title: "여름 바다 수채화전", kind: "전시", artist: "이수진", startsOn: day(-60), endsOn: day(-30), intro: null, store: at(0) },
  ] satisfies Exhibition[];
}
