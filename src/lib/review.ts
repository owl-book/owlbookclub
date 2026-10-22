import "server-only";
import { db, hasDb } from "@/lib/db";
import { exhibitionFromRow, type Exhibition, type ExhibitionRow } from "@/lib/exhibitions";
import { MEETING_SELECT, meetingFromRow, type Meeting, type MeetingRow } from "@/lib/meetings";

// 승인 대기(0023). Claude가 정리한 모임·책방을 숨긴 채(pending_review) 넣어 두면, 운영자 화면에서 보고 승인한다.
// 대기 모임은 is_hidden, 대기 책방은 is_blocked 도 켜져 있어서 공개 화면에는 나오지 않는다.

export type PendingStore = {
  id: number;
  name: string;
  region: string;
  address: string | null;
  intro: string | null;
  hours: string | null;
  phone: string | null;
  instagramUrl: string | null;
  note: string | null;
};

export type PendingMeeting = Meeting & { note: string | null; postUrlRaw: string | null };

// 책방별 한 묶음. store 는 책방도 대기 중일 때만 있다(이미 공개된 책방에 새 모임만 들어온 경우 null)
export type ReviewGroup = {
  storeId: number;
  storeName: string;
  region: string;
  store: PendingStore | null;
  meetings: PendingMeeting[];
};

type StoreRow = {
  id: number;
  name: string;
  region: string;
  address?: string | null;
  intro?: string | null;
  hours?: string | null;
  phone?: string | null;
  instagram_url: string | null;
  review_note?: string | null;
};

function storeFromRow(r: StoreRow): PendingStore {
  const t = (v: string | null | undefined) => v?.trim() || null;
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    address: t(r.address),
    intro: t(r.intro),
    hours: t(r.hours),
    phone: t(r.phone),
    instagramUrl: t(r.instagram_url),
    note: t(r.review_note),
  };
}

// 대기 모임에 같은 묶음(series_key)의 대기 회차를 붙인다. 공개 화면의 attachSeries 는 숨긴 회차를 빼므로 따로 만든다
function attachPendingSeries(meetings: PendingMeeting[]): PendingMeeting[] {
  const byKey = new Map<string, PendingMeeting[]>();
  for (const m of meetings) if (m.seriesKey) byKey.set(m.seriesKey, [...(byKey.get(m.seriesKey) ?? []), m]);
  return meetings.map((m) => {
    const list = m.seriesKey ? byKey.get(m.seriesKey) : undefined;
    if (!list || list.length < 2) return m;
    const sessions = list.map((x) => ({ id: x.id, startsAt: x.startsAt, endsAt: x.endsAt, timeNote: x.timeNote, bookTitle: x.bookTitle }));
    return { ...m, series: { sessions, collapsed: false } };
  });
}

export type ReviewQueue = { ready: true; groups: ReviewGroup[]; total: number } | { ready: false };

// ready=false: DB에 0023 설정문을 아직 실행하지 않아 대기 칸이 없음
export async function getReviewQueue(): Promise<ReviewQueue> {
  if (!hasDb()) return { ready: true, groups: [], total: 0 };
  const [ms, ss] = await Promise.all([
    db().from("meetings").select(MEETING_SELECT).eq("pending_review", true).order("starts_at", { ascending: true }).limit(300),
    db().from("stores").select("*").eq("pending_review", true).order("name").limit(100),
  ]);
  if (ms.error || ss.error) {
    console.error("[owl] review queue read failed", ms.error?.message ?? ss.error?.message);
    return { ready: false };
  }

  type Row = MeetingRow & { review_note?: string | null };
  const meetings = attachPendingSeries(
    (ms.data as unknown as Row[]).map((r) => ({ ...meetingFromRow(r), note: r.review_note?.trim() || null, postUrlRaw: r.post_url })),
  );
  const groups = new Map<number, ReviewGroup>();
  for (const s of (ss.data as StoreRow[]).map(storeFromRow)) {
    groups.set(s.id, { storeId: s.id, storeName: s.name, region: s.region, store: s, meetings: [] });
  }
  for (const m of meetings) {
    const g = groups.get(m.store.id) ?? { storeId: m.store.id, storeName: m.store.name, region: m.store.region, store: null, meetings: [] };
    g.meetings.push(m);
    groups.set(m.store.id, g);
  }
  // 날짜가 가장 가까운 모임이 있는 책방부터
  const first = (g: ReviewGroup) => g.meetings[0]?.startsAt.getTime() ?? Number.MAX_SAFE_INTEGER;
  const list = [...groups.values()].sort((a, b) => first(a) - first(b) || a.storeName.localeCompare(b.storeName, "ko"));
  return { ready: true, groups: list, total: meetings.length + list.filter((g) => g.store).length };
}

// 운영자 탭에 보일 남은 수(모임 + 책방 + 전시). 읽지 못하면 0. 전시 표(0024)가 없으면 전시는 0으로 센다
export async function getReviewCount(): Promise<number> {
  if (!hasDb()) return 0;
  const count = (table: "meetings" | "stores" | "exhibitions") => db().from(table).select("id", { count: "exact", head: true }).eq("pending_review", true);
  const [m, s, e] = await Promise.all([count("meetings"), count("stores"), count("exhibitions")]);
  if (m.error || s.error) return 0;
  return (m.count ?? 0) + (s.count ?? 0) + (e.error ? 0 : (e.count ?? 0));
}

// 승인 대기 전시(0024). 책방이 아직 대기 중(is_blocked)이어도 보여 준다: 승인할 때 책방이 공개돼 있는지 따로 확인한다
export type PendingExhibition = Exhibition & { note: string | null; storeBlocked: boolean };

// null: 0024 설정문을 아직 실행하지 않아 전시 표가 없음
export async function getPendingExhibitions(): Promise<PendingExhibition[] | null> {
  if (!hasDb()) return [];
  const { data, error } = await db()
    .from("exhibitions")
    .select("*, store:stores!inner(id, name, region, is_blocked)")
    .eq("pending_review", true)
    .order("starts_on", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[owl] pending exhibitions read failed", error.message);
    return null;
  }
  return (data as ExhibitionRow[]).map((r) => ({ ...exhibitionFromRow(r), note: r.review_note?.trim() || null, storeBlocked: r.store.is_blocked }));
}

// 미리보기용으로 대기 모임 하나를 읽는다(대기 중이 아니면 null)
export async function getPendingMeeting(id: number): Promise<PendingMeeting | null> {
  if (!Number.isSafeInteger(id) || id <= 0 || !hasDb()) return null;
  const q = await getReviewQueue();
  if (!q.ready) return null;
  for (const g of q.groups) {
    const m = g.meetings.find((x) => x.id === id);
    if (m) return m;
  }
  return null;
}
