import "server-only";
import { db } from "@/lib/db";

// 어드민 '통계': 모임별·책방별로 카드 클릭 · 신청하기 클릭 · 찜(하트) · 내 모임에 담은 수를 센다.
// 카드 클릭·신청하기 클릭은 events 표(봇·운영자 기기 제외), 찜은 meeting_wishes·store_wishes, 담은 수는 meeting_plans(신청했어요 표시)에서 읽는다.
// 기간은 한국 시간 날짜 기준. 찜·담은 수는 '그 기간에 새로 누른 것 중 지금 남아 있는 것'이다(취소한 건 빠짐).
export type StatRow = { id: number; name: string; sub?: string; card: number; apply: number; wish: number; plan: number };
export type Stats = { meetings: StatRow[]; stores: StatRow[]; storeWishOnly: number };

type MeetingRow = { id: number; title: string; starts_at: string; store: { id: number; name: string } };

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' 두 날짜(포함)를 한국 시간 기준 [시작, 끝) 시각으로
export function rangeOf(from: string, to: string): { fromIso: string; toIso: string } {
  const start = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(new Date(`${to}T00:00:00+09:00`).getTime() + DAY_MS);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

// 한 번에 1000줄까지만 오므로 이어서 읽는다
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
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
  const [events, mWishes, sWishes, plans, meetings] = await Promise.all([
    readAll<{ type: string; meeting_id: number | null }>((a, b) =>
      db()
        .from("events")
        .select("type, meeting_id")
        .in("type", ["card_click", "apply_click"])
        .eq("is_bot", false)
        .eq("is_internal", false)
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .not("meeting_id", "is", null)
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
    readAll<MeetingRow>(
      (a, b) => db().from("meetings").select("id, title, starts_at, store:stores!inner(id, name)").order("id").range(a, b) as unknown as PromiseLike<{ data: MeetingRow[] | null; error: { message: string } | null }>,
    ),
  ]);

  const byMeeting = new Map<number, StatRow>();
  const storeOf = new Map<number, { id: number; name: string }>();
  for (const m of meetings) {
    storeOf.set(m.id, m.store);
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
  const bump = (id: number | null, key: "card" | "apply" | "wish" | "plan") => {
    const row = id == null ? undefined : byMeeting.get(id);
    if (row) row[key] += 1;
  };
  for (const e of events) bump(e.meeting_id, e.type === "card_click" ? "card" : "apply");
  for (const w of mWishes) bump(w.meeting_id, "wish");
  for (const p of plans) bump(p.meeting_id, "plan");

  // 책방은 모임 숫자를 합치고, 책방 하트(책방 자체를 찜한 수)는 따로 더한다. 책방 표의 '찜'은 책방 하트다
  const byStore = new Map<number, StatRow>();
  for (const m of byMeeting.values()) {
    const store = storeOf.get(m.id)!;
    const row = byStore.get(store.id) ?? { id: store.id, name: store.name, card: 0, apply: 0, wish: 0, plan: 0 };
    row.card += m.card;
    row.apply += m.apply;
    row.plan += m.plan;
    byStore.set(store.id, row);
  }
  let storeWishOnly = 0;
  for (const w of sWishes) {
    const row = byStore.get(w.store_id);
    if (row) row.wish += 1;
    else storeWishOnly += 1;
  }

  const used = (r: StatRow) => r.card + r.apply + r.wish + r.plan > 0;
  const sort = (a: StatRow, b: StatRow) => b.apply - a.apply || b.card - a.card || b.wish - a.wish || b.plan - a.plan;
  return {
    meetings: [...byMeeting.values()].filter(used).sort(sort),
    stores: [...byStore.values()].filter(used).sort(sort),
    storeWishOnly,
  };
}
