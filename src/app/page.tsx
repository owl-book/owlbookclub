import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { MeetingList } from "@/components/MeetingList";
import { getWishContext } from "@/lib/me";
import { countByDay, filterMeetings, getRecentPastMeetings, getUpcomingMeetings, matchesChoices, matchesQuery, type Choices } from "@/lib/meetings";
import { isGuOf, isSido } from "@/lib/regions";
import { isFormat, isGenre } from "@/lib/tags";
import { DATE_FILTERS, formatDayNum, isDateFilter, kstDayNumber, parseDayKey } from "@/lib/time";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const day = parseDayKey(sp.day);
  const date = day == null && isDateFilter(sp.d) ? sp.d : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const sido = isSido(sp.sido) ? sp.sido : null;
  const gu = sido && isGuOf(sido, sp.gu) ? sp.gu : null;
  const choices: Choices = { sido, gu, genre: isGenre(sp.genre) ? sp.genre : null, format: isFormat(sp.format) ? sp.format : null };
  const showPast = sp.past === "1";
  const now = new Date();
  const today = kstDayNumber(now);

  const [upcoming, wishes] = await Promise.all([getUpcomingMeetings(now), getWishContext()]);
  const results = filterMeetings(upcoming, { date, q, now, day, choices });

  // 달력의 점: 날짜 조건은 빼고 검색어·필터만 반영한 모임 수
  const searched = upcoming.filter((m) => matchesQuery(m, q) && matchesChoices(m, choices));
  const counts = countByDay(searched);
  const lastDay = upcoming.length ? kstDayNumber(upcoming[upcoming.length - 1].startsAt) : null;

  // 빈 결과: 검색어는 유지한 채 가까운 다른 날짜 모임, 그래도 없으면 전체에서 가까운 모임
  let nearby: typeof upcoming = [];
  if (results.length === 0) {
    nearby = searched.slice(0, 3);
    if (nearby.length === 0) nearby = upcoming.slice(0, 3);
  }

  const past = showPast ? await getRecentPastMeetings(now) : [];
  const dateLabel = day != null ? formatDayNum(day) : date !== "all" ? DATE_FILTERS.find((f) => f.key === date)?.label : "";
  const regionLabel = sido ? `${sido}${gu ? ` ${gu}` : ""}` : "";
  const condition = [regionLabel, choices.genre ?? "", choices.format ?? "", q ? `‘${q}’` : "", dateLabel].filter(Boolean).join(" ");
  const summary = `${condition ? `${condition} ` : ""}모임 ${results.length}개${results.length > 0 ? " · 가까운 날짜순" : ""}`;

  return (
    <div className="pt-5">
      {sp.bye === "1" && (
        <p role="status" className="mb-4 rounded-xs border border-info-border bg-info-surface px-3 py-2.5 text-b2 text-info">
          탈퇴가 끝났어요. 찜과 기록을 모두 지웠습니다. 그동안 고마웠어요.
        </p>
      )}
      <section className="mb-5">
        <h1 className="font-display text-h1 text-ink">
          동네책방 독서모임,
          <br />
          날짜별로 한눈에
        </h1>
        <p className="mt-2 text-b2 text-ink-2">서울·경기 동네책방 모임을 고르면 책방 신청 페이지로 바로 연결해 드립니다.</p>
      </section>

      <FilterBar date={date} q={q} day={day} choices={choices} today={today} counts={counts} lastDay={lastDay} resultCount={results.length} summary={summary} />

      <section className="mt-1" aria-live="polite">
        {results.length > 0 ? (
          <>
            <MeetingList meetings={results} now={now} wishes={wishes} />
          </>
        ) : (
          <div>
            <div className="rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
              <p className="text-t2 text-ink">{condition ? `${condition} 조건에 맞는` : "아직 올라온"} 모임이 없어요</p>
              <p className="mt-1 text-b2 text-ink-2">매주 월요일에 새 모임을 채워 넣습니다.</p>
            </div>
            {nearby.length > 0 && (
              <>
                <h2 className="mb-1 mt-6 text-l1 font-semibold text-ink">가까운 다른 날짜의 모임</h2>
                <MeetingList meetings={nearby} now={now} wishes={wishes} />
              </>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        {showPast ? (
          <>
            <h2 className="mb-1 text-l1 font-semibold text-ink-2">최근 30일 지난 모임</h2>
            {past.length === 0 ? (
              <p className="text-b2 text-ink-2">지난 모임이 없습니다.</p>
            ) : (
              <MeetingList meetings={past} now={now} wishes={wishes} />
            )}
          </>
        ) : (
          <Link href="/?past=1" className="inline-flex min-h-11 items-center text-l1 text-ink-2 underline">
            지난 모임 보기
          </Link>
        )}
      </section>
    </div>
  );
}
