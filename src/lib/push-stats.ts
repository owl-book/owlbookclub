import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_PUSH_PREFS, type PushPlatform, type PushPrefKey } from "@/lib/push-shared";
import { kstDayNumber, sundayOf } from "@/lib/time";

// 운영자 화면 '알림' 탭의 숫자. 사람 수만 세고 누구인지는 보여 주지 않는다.
// 운영자 기기(?owl_internal=1 로 표시한 기기)에서 켠 알림과 시험 알림은 뺀다.

export const PUSH_GOAL = 20; // 기획서 중간 기준: 6개월 안에 알림을 켠 사람 20명
const WEEKS = 4;

export type PushStats = {
  people: number; // 알림을 켠 사람(기기가 하나라도 있는 회원)
  devices: number;
  byPref: Record<PushPrefKey, number>;
  byPlatform: Record<PushPlatform, number>;
  installed: number; // 홈 화면 앱에서 켠 기기
  weeks: { start: number; sent: number; opened: number }[]; // start: 그 주 일요일의 날짜 번호(KST)
  total: { sent: number; opened: number };
};

type SubRow = { user_id: string; platform: PushPlatform; installed: boolean; is_internal: boolean };
type PrefRow = { user_id: string; meeting: boolean; store_new: boolean; exhibition: boolean };
type SendRow = { sent_at: string; opened_at: string | null; kinds: string[]; devices: number };

export async function getPushStats(now = new Date()): Promise<PushStats> {
  const thisWeek = sundayOf(kstDayNumber(now));
  const firstWeek = thisWeek - (WEEKS - 1) * 7;
  const since = new Date(firstWeek * 86400000 - 9 * 3600000).toISOString();

  const [subsRes, sendsRes, allSendsRes] = await Promise.all([
    db().from("push_subscriptions").select("user_id, platform, installed, is_internal").eq("is_internal", false),
    db().from("push_sends").select("sent_at, opened_at, kinds, devices").eq("is_internal", false).gte("sent_at", since),
    // 지금까지 전체(열어 본 비율의 큰 숫자)
    db().from("push_sends").select("opened_at, kinds, devices").eq("is_internal", false),
  ]);
  for (const r of [subsRes, sendsRes, allSendsRes]) if (r.error) throw new Error(`알림 통계 읽기 실패: ${r.error.message}`);

  const subs = (subsRes.data ?? []) as SubRow[];
  const people = [...new Set(subs.map((s) => s.user_id))];

  const byPlatform: Record<PushPlatform, number> = { ios: 0, android: 0, desktop: 0, other: 0 };
  for (const s of subs) byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + 1;

  // 종류별: 설정 줄이 없는 사람은 모두 켠 것으로 본다
  const byPref: Record<PushPrefKey, number> = { meeting: 0, store_new: 0, exhibition: 0 };
  if (people.length > 0) {
    const { data, error } = await db().from("push_prefs").select("user_id, meeting, store_new, exhibition").in("user_id", people);
    if (error) throw new Error(`알림 통계 읽기 실패: ${error.message}`);
    const prefs = new Map(((data ?? []) as PrefRow[]).map((r) => [r.user_id, r]));
    for (const id of people) {
      const p = prefs.get(id) ?? DEFAULT_PUSH_PREFS;
      if (p.meeting) byPref.meeting++;
      if (p.store_new) byPref.store_new++;
      if (p.exhibition) byPref.exhibition++;
    }
  }

  // 실제로 기기에 전달된 알림만 센다(시험 알림 제외)
  const real = <T extends { kinds: string[]; devices: number }>(rows: T[]) => rows.filter((r) => r.devices > 0 && !r.kinds.includes("test"));

  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: firstWeek + i * 7, sent: 0, opened: 0 }));
  for (const r of real((sendsRes.data ?? []) as SendRow[])) {
    const w = weeks.find((x) => x.start === sundayOf(kstDayNumber(new Date(r.sent_at))));
    if (!w) continue;
    w.sent++;
    if (r.opened_at) w.opened++;
  }
  const all = real((allSendsRes.data ?? []) as Omit<SendRow, "sent_at">[]);

  return {
    people: people.length,
    devices: subs.length,
    byPref,
    byPlatform,
    installed: subs.filter((s) => s.installed).length,
    weeks,
    total: { sent: all.length, opened: all.filter((r) => r.opened_at).length },
  };
}
