import Link from "next/link";
import type { SeriesSession } from "@/lib/meetings";
import { formatKstDateOnly, meetingTime, meetingWhen } from "@/lib/time";

// 묶음 모임의 회차 일정. '한 번에 신청' 안내는 위쪽 정보 칸의 '신청' 줄이 맡는다.
// 모든 회차의 시간이 같으면 시간은 제목 옆에 한 번만 쓰고 줄마다 날짜·책만 둔다(같은 시간이 줄마다 반복되면 줄이 넘어가 길어진다).
// 지금 보는 회차는 면으로 강조하고, 다른 회차는 눌러서 그 회차 화면(책·소개)으로 갈 수 있다.
// 모임 소개 안에 붙을 때는 소제목(h3), 소개가 없어 혼자 설 때는 h2로 쓴다.
export function SeriesSchedule({ current, sessions, now, nested = false }: { current: number; sessions: SeriesSession[]; now: Date; nested?: boolean }) {
  const timeOf = (x: SeriesSession) => meetingTime(x);
  const sharedTime = sessions.every((x) => timeOf(x) === timeOf(sessions[0])) ? timeOf(sessions[0]) : null;
  const Heading = nested ? "h3" : "h2";
  return (
    <section aria-labelledby="series-schedule" className={nested ? "mt-5" : "mt-6"}>
      <Heading id="series-schedule" className={nested ? "text-b1 font-semibold text-ink" : "text-t2 text-ink"}>
        회차 일정
      </Heading>
      {sharedTime && <p className="mt-1 text-b2 text-ink-2">시간은 모든 회차 {sharedTime}</p>}
      <ol className="mt-3 overflow-hidden rounded-md border border-border-card bg-card">
        {sessions.map((x, i) => {
          const here = x.id === current;
          const done = x.startsAt.getTime() < now.getTime();
          const when = sharedTime ? formatKstDateOnly(x.startsAt) : meetingWhen(x);
          const body = (
            <>
              <span className={`w-9 shrink-0 text-l1 font-semibold ${done ? "text-ink-3" : "text-navy"}`}>{i + 1}회</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-b2 ${done ? "text-ink-3" : "text-ink"} ${here ? "font-semibold" : ""}`}>{when}</span>
                {x.bookTitle && <span className={`mt-0.5 block truncate text-l2 ${done ? "text-ink-3" : "text-ink-2"}`}>『{x.bookTitle}』</span>}
              </span>
              {here ? (
                <span className="shrink-0 text-l2 font-semibold text-navy">지금 보는 회차</span>
              ) : done ? (
                <span className="shrink-0 text-l2 text-ink-3">지남</span>
              ) : null}
            </>
          );
          const row = "flex min-h-11 items-center gap-3 px-4 py-2.5";
          return (
            <li key={x.id} className={i > 0 ? "border-t border-border" : ""}>
              {here ? (
                <div aria-current="true" className={`${row} bg-sub`}>
                  {body}
                </div>
              ) : (
                <Link href={`/m/${x.id}`} className={`${row} hover:bg-sub`}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
