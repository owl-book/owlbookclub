import { MeetingCard } from "@/components/MeetingCard";
import type { Meeting } from "@/lib/meetings";
import type { WishContext } from "@/lib/me";
import { formatDayNum, kstDayNumber } from "@/lib/time";

const RELATIVE: Record<number, string> = { [-1]: "어제", 0: "오늘", 1: "내일", 2: "모레" };

// 모임을 날짜별로 묶어 "오늘 · 10월 3일 (토)" 제목 아래에 보여준다. 들어온 순서(가까운 날짜순 또는 최근순)를 그대로 따른다.
// emptyDays: 달력에서 골랐지만 모임이 없는 날. 가까운 날짜순 목록 사이에 날짜 순서대로 한 줄씩 끼워 넣는다.
export function MeetingList({
  meetings,
  now,
  wishes,
  hideStore,
  emptyDays,
  emptyLabel = "모임 없음",
}: {
  meetings: Meeting[];
  now: Date;
  wishes?: WishContext;
  hideStore?: boolean;
  emptyDays?: number[];
  emptyLabel?: string;
}) {
  const today = kstDayNumber(now);
  const groups: { day: number; items: Meeting[] }[] = [];
  for (const m of meetings) {
    const day = kstDayNumber(m.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  if (emptyDays?.length) {
    groups.push(...emptyDays.map((day) => ({ day, items: [] })));
    groups.sort((a, b) => a.day - b.day);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const rel = RELATIVE[g.day - today];
        if (g.items.length === 0) {
          // 모임 없는 날: 카드 없이 회색 한 줄. 화면 위에 붙지 않게 해서 모임 있는 날 제목을 가리지 않는다
          return (
            <p key={g.day} className="flex flex-wrap items-baseline gap-x-1.5 border-b border-dashed border-border-card py-2.5 text-l2 text-ink-3">
              <span className="text-l1 font-medium text-ink-2">
                {rel && `${rel} · `}
                {formatDayNum(g.day)}
              </span>
              {emptyLabel}
            </p>
          );
        }
        return (
          <section key={g.day} aria-label={formatDayNum(g.day)}>
            {/* 머리글(h-14) 바로 아래에 붙어서, 스크롤해도 지금 보는 날짜가 보인다 */}
            <h2 className="sticky top-14 z-10 -mx-4 bg-page/95 px-4 py-2 text-l1 font-semibold text-ink backdrop-blur">
              {rel && <span className="text-navy">{rel} · </span>}
              {formatDayNum(g.day)}
              <span className="ml-1.5 font-medium text-ink-3">{g.items.length}개</span>
            </h2>
            <ul className="mt-1 space-y-3">
              {g.items.map((m) => (
                <li key={m.id}>
                  <MeetingCard
                    meeting={m}
                    now={now}
                    hideStore={hideStore}
                    wish={wishes?.enabled ? { wished: wishes.meetingIds.has(m.id), loggedIn: Boolean(wishes.user) } : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
