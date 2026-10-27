import { RevealScroll } from "@/components/LoadMoreLink";
import { MeetingCard } from "@/components/MeetingCard";
import { isClosed, type Meeting } from "@/lib/meetings";
import type { WishContext } from "@/lib/me";
import { count, joinDot, joinDotText } from "@/lib/format";
import { formatDayNum, kstDayNumber } from "@/lib/time";

const RELATIVE: Record<number, string> = { [-1]: "어제", 0: "오늘", 1: "내일", 2: "모레" };

// 모임을 날짜별로 묶어 "오늘 · 10월 3일 (토)" 제목 아래에 보여준다. 들어온 순서(가까운 날짜순 또는 최근순)를 그대로 따른다.
// emptyDays: 달력에서 골랐지만 모임이 없는 날. 가까운 날짜순 목록 사이에 날짜 순서대로 한 줄씩 끼워 넣는다.
// revealFrom: '더 보기'로 방금 붙은 모임이 몇 번째부터인지. 그 뒤 날짜 묶음은 아래에서 떠오르고, 화면이 그 자리까지 부드럽게 밀려 올라간다.
export function MeetingList({
  meetings,
  now,
  wishes,
  hideStore,
  emptyDays,
  emptyLabel = "모임 없음",
  revealFrom,
}: {
  meetings: Meeting[];
  now: Date;
  wishes?: WishContext;
  hideStore?: boolean;
  emptyDays?: number[];
  emptyLabel?: string;
  revealFrom?: number;
}) {
  const today = kstDayNumber(now);
  const groups: { day: number; items: Meeting[] }[] = [];
  for (const m of meetings) {
    const day = kstDayNumber(m.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  // 하루 안에서는 신청할 수 있는 모임을 먼저, 마감된 모임은 아래로(마감끼리·열린 것끼리는 들어온 순서 그대로)
  for (const g of groups) g.items.sort((a, b) => Number(isClosed(a, now)) - Number(isClosed(b, now)));
  if (emptyDays?.length) {
    groups.push(...emptyDays.map((day) => ({ day, items: [] })));
    groups.sort((a, b) => a.day - b.day);
  }

  // 새로 붙은 묶음은 앞 묶음들까지의 모임 수가 revealFrom 이상인 것부터(같은 날은 나뉘지 않으니 묶음 단위로 갈린다)
  let before = 0;
  let split = groups.length;
  if (revealFrom !== undefined) {
    split = groups.findIndex((g) => {
      const isNew = before >= revealFrom;
      before += g.items.length;
      return isNew;
    });
    if (split === -1) split = groups.length;
  }

  const renderGroup = (g: (typeof groups)[number]) => {
    const rel = RELATIVE[g.day - today];
    if (g.items.length === 0) {
      // 모임 없는 날: 카드 없이 회색 한 줄. 화면 위에 붙지 않게 해서 모임 있는 날 제목을 가리지 않는다
      return (
        <p key={g.day} className="flex flex-wrap items-baseline gap-x-1.5 border-b border-dashed border-border-card py-2.5 text-l2 text-ink-3">
          <span className="text-l1 font-medium text-ink-2">
            {joinDotText(rel, formatDayNum(g.day))}
          </span>
          {emptyLabel}
        </p>
      );
    }
    const closed = g.items.filter((m) => isClosed(m, now)).length;
    // 카드마다 테두리 상자를 두지 않고, 모임 사이에 옅은 선 하나만 긋는다
    const cards = (
      <ul className="divide-y divide-border">
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
    );
    if (closed === g.items.length) {
      // 모두 마감인 날: 모임 없는 날과 같은 회색 한 줄로 접고, '보기'를 누르면 그 자리에서 카드를 펼친다
      return (
        <details key={g.day} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-1.5 border-b border-dashed border-border-card py-2.5 text-l2 text-ink-2 [&::-webkit-details-marker]:hidden">
            <span className="text-l1 font-medium text-ink-2">{joinDotText(rel, formatDayNum(g.day))}</span>
            {/* 앞 날짜와 같은 크기, 표지의 '신청마감' 뱃지와 같은 경고색 */}
            <span className="text-l1 font-medium text-warning">모두 마감</span>
            <span className="ml-auto text-navy underline underline-offset-2">
              <span className="group-open:hidden">보기 ⌄</span>
              <span className="hidden group-open:inline">접기 ⌃</span>
            </span>
          </summary>
          {cards}
        </details>
      );
    }
    return (
      <section key={g.day} aria-label={formatDayNum(g.day)}>
        {/* 머리글(h-14) 바로 아래에 붙어서, 스크롤해도 지금 보는 날짜가 보인다 */}
        {/* 날짜(16px 검정)가 카드 시간(14px 회색)보다 먼저 눈에 들어오게. 개수는 마감 포함 전체(마감은 카드 표지 뱃지로 보인다) */}
        <h2 className="sticky top-14 z-10 -mx-4 bg-page/95 px-4 pb-0 pt-1 text-b1 font-semibold leading-snug text-ink backdrop-blur">
          {joinDot(rel, formatDayNum(g.day), <span className="fig font-medium text-navy">{count(g.items.length, "개")}</span>)}
        </h2>
        {cards}
      </section>
    );
  };

  // 날짜 묶음 사이는 넓게(24px), 날짜 제목과 그날 첫 카드 사이는 좁게(제목 아래 여백 0) 해서 제목이 아래 카드들과 한 묶음으로 보이게
  // 새로 붙은 칸에서는 그 24px 간격을 칸 안쪽(pt-6)에 넣어, 화면을 올렸을 때 머리글(h-14)과 첫 날짜 사이가 띄워지게 한다
  const fresh = groups.slice(split);
  return (
    <div className="space-y-6">
      {groups.slice(0, split).map(renderGroup)}
      {fresh.length > 0 && (
        <div className={`owl-reveal scroll-mt-14 ${split > 0 ? "-mt-6 pt-6" : ""}`}>
          <RevealScroll />
          <div className="space-y-6">{fresh.map(renderGroup)}</div>
        </div>
      )}
    </div>
  );
}
