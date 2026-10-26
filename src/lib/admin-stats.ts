import "server-only";
import { db } from "@/lib/db";
import { DATE_FILTERS } from "@/lib/time";

// 어드민 '통계': 모임별·책방별로 카드 클릭 · 신청하기 클릭 · 찜(하트) · 내 모임에 담은 수, 책방별로 화면 조회 · 지도 · 전화 · 인스타 클릭,
// 그리고 홈에서 결과가 0건이었던 검색·필터 조건을 센다.
// 클릭·조회·0건은 events 표(봇·운영자 기기 제외), 찜은 meeting_wishes·store_wishes, 담은 수는 meeting_plans(신청했어요 표시)에서 읽는다.
// 기간은 한국 시간 날짜 기준. 찜·담은 수는 '그 기간에 새로 누른 것 중 지금 남아 있는 것'이다(취소한 건 빠짐).
export type StatRow = { id: number; name: string; sub?: string; card: number; apply: number; wish: number; plan: number };
export type StoreStatRow = StatRow & { view: number; map: number; tel: number; instagram: number };
export type EmptySearch = { label: string; count: number; last: Date };
export type Stats = { meetings: StatRow[]; stores: StoreStatRow[]; emptySearches: EmptySearch[] };

type MeetingRow = { id: number; title: string; starts_at: string; store_id: number; store: { name: string } };
type EventRow = { type: string; meeting_id: number | null; store_id: number | null; props: Record<string, unknown> | null; created_at: string };

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_TOP = 20;
const CONTACT_KINDS = ["map", "tel", "instagram"] as const;

// 'YYYY-MM-DD' 두 날짜(포함)를 한국 시간 기준 [시작, 끝) 시각으로
export function rangeOf(from: string, to: string): { fromIso: string; toIso: string } {
  const start = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(new Date(`${to}T00:00:00+09:00`).getTime() + DAY_MS);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// 한 번에 1000줄까지만 오므로 이어서 읽는다
async function readAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getAdminStats(from: string, to: string): Promise<Stats> {
  const { fromIso, toIso } = rangeOf(from, to);
  const [events, mWishes, sWishes, plans, meetings, stores] = await Promise.all([
    readAll<EventRow>((a, b) =>
      db()
        .from("events")
        .select("type, meeting_id, store_id, props, created_at")
        .in("type", ["card_click", "apply_click", "store_view", "store_contact", "search_empty"])
        .eq("is_bot", false)
        .eq("is_internal", false)
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .order("id")
        .range(a, b),
    ),
    readAll<{ meeting_id: number }>((a, b) =>
      db().from("meeting_wishes").select("meeting_id").gte("created_at", fromIso).lt("created_at", toIso).order("created_at").range(a, b),
    ),
    readAll<{ store_id: number }>((a, b) =>
      db().from("store_wishes").select("store_id").gte("created_at", fromIso).lt("created_at", toIso).order("created_at").range(a, b),
    ),
    readAll<{ meeting_id: number }>((a, b) =>
      db().from("meeting_plans").select("meeting_id").not("applied_at", "is", null).gte("applied_at", fromIso).lt("applied_at", toIso).order("applied_at").range(a, b),
    ),
    readAll<MeetingRow>((a, b) => db().from("meetings").select("id, title, starts_at, store_id, store:stores!inner(name)").order("id").range(a, b) as unknown as Page<MeetingRow>),
    readAll<{ id: number; name: string }>((a, b) => db().from("stores").select("id, name").order("id").range(a, b)),
  ]);

  const byMeeting = new Map<number, StatRow>();
  const storeOf = new Map<number, number>();
  for (const m of meetings) {
    storeOf.set(m.id, m.store_id);
    byMeeting.set(m.id, {
      id: m.id,
      name: m.title,
      sub: `${m.store.name} · ${new Date(m.starts_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })}`,
      card: 0,
      apply: 0,
      wish: 0,
      plan: 0,
    });
  }
  const byStore = new Map<number, StoreStatRow>();
  for (const s of stores) byStore.set(s.id, { id: s.id, name: s.name, card: 0, apply: 0, wish: 0, plan: 0, view: 0, map: 0, tel: 0, instagram: 0 });

  const bump = (id: number | null, key: "card" | "apply" | "wish" | "plan") => {
    const row = id == null ? undefined : byMeeting.get(id);
    if (row) row[key] += 1;
  };
  const empties = new Map<string, EmptySearch>();
  for (const e of events) {
    if (e.type === "card_click") bump(e.meeting_id, "card");
    else if (e.type === "apply_click") bump(e.meeting_id, "apply");
    else if (e.type === "search_empty") {
      const label = emptyLabel(e.props ?? {});
      const at = new Date(e.created_at);
      const item = empties.get(label) ?? { label, count: 0, last: at };
      item.count += 1;
      if (at > item.last) item.last = at;
      empties.set(label, item);
    } else {
      const row = e.store_id == null ? undefined : byStore.get(e.store_id);
      if (!row) continue;
      if (e.type === "store_view") row.view += 1;
      else {
        const kind = e.props?.kind;
        if (CONTACT_KINDS.includes(kind as (typeof CONTACT_KINDS)[number])) row[kind as (typeof CONTACT_KINDS)[number]] += 1;
      }
    }
  }
  for (const w of mWishes) bump(w.meeting_id, "wish");
  for (const p of plans) bump(p.meeting_id, "plan");

  // 책방은 모임 숫자(카드·신청·담음)를 합치고, 찜은 책방 자체의 하트를 센다
  for (const m of byMeeting.values()) {
    const row = byStore.get(storeOf.get(m.id)!);
    if (!row) continue;
    row.card += m.card;
    row.apply += m.apply;
    row.plan += m.plan;
  }
  for (const w of sWishes) {
    const row = byStore.get(w.store_id);
    if (row) row.wish += 1;
  }

  const used = (r: StatRow) => r.card + r.apply + r.wish + r.plan > 0;
  const usedStore = (r: StoreStatRow) => used(r) || r.view + r.map + r.tel + r.instagram > 0;
  const sort = (a: StatRow, b: StatRow) => b.apply - a.apply || b.card - a.card || b.wish - a.wish || b.plan - a.plan;
  const sortStore = (a: StoreStatRow, b: StoreStatRow) => sort(a, b) || b.view - a.view;
  return {
    meetings: [...byMeeting.values()].filter(used).sort(sort),
    stores: [...byStore.values()].filter(usedStore).sort(sortStore),
    emptySearches: [...empties.values()].sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime()).slice(0, EMPTY_TOP),
  };
}

// 결과 0건 조건을 한 줄로: '검색어 · 지역 · 장르 · 모임방식 · 날짜'(고른 것만)
function emptyLabel(p: Record<string, unknown>): string {
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  const date = str("date");
  const parts = [
    str("q") && `‘${str("q")}’`,
    [str("sido"), str("gu")].filter(Boolean).join(" "),
    str("genre"),
    str("format"),
    date && date !== "all" ? (DATE_FILTERS.find((f) => f.key === date)?.label ?? date) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "(조건 없음)";
}
