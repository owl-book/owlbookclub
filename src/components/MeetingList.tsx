import { MeetingCard } from "@/components/MeetingCard";
import type { Meeting } from "@/lib/meetings";
import type { WishContext } from "@/lib/me";
import { formatDayNum, kstDayNumber } from "@/lib/time";

const RELATIVE: Record<number, string> = { [-1]: "어제", 0: "오늘", 1: "내일", 2: "모레" };

// 모임을 날짜별로 묶어 "오늘 · 10월 3일 (토)" 제목 아래에 보여준다. 들어온 순서(가까운 날짜순 또는 최근순)를 그대로 따른다.
export function MeetingList({ meetings, now, wishes }: { meetings: Meeting[]; now: Date; wishes?: WishContext }) {
  const today = kstDayNumber(now);
  const groups: { day: number; items: Meeting[] }[] = [];
  for (const m of meetings) {
    const day = kstDayNumber(m.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const rel = RELATIVE[g.day - today];
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
