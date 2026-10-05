import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { MeetingList } from "@/components/MeetingList";
import { PendingApplies } from "@/components/PendingApplies";
import { getWishContext } from "@/lib/me";
import { countByDay, filterMeetings, getRecentPastMeetings, getUpcomingMeetings, matchesChoices, matchesQuery, type Choices } from "@/lib/meetings";
import { isGuOf, isSido } from "@/lib/regions";
import { isFormat, isGenre } from "@/lib/tags";
import { DATE_FILTERS, formatDays, isDateFilter, kstDayNumber, parseDayKeys } from "@/lib/time";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const now = new Date();
  const today = kstDayNumber(now);
  // 달력에서 고른 날짜들(지난 날은 예전 링크로 들어와도 뺀다)
  const days = parseDayKeys(sp.day).filter((d) => d >= today);
  const date = days.length === 0 && isDateFilter(sp.d) ? sp.d : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const sido = isSido(sp.sido) ? sp.sido : null;
  const gu = sido && isGuOf(sido, sp.gu) ? sp.gu : null;
  const choices: Choices = { sido, gu, genre: isGenre(sp.genre) ? sp.genre : null, format: isFormat(sp.format) ? sp.format : null };
  const showPast = sp.past === "1";

  const [upcoming, wishes] = await Promise.all([getUpcomingMeetings(now), getWishContext()]);
  const results = filterMeetings(upcoming, { date, q, now, days, choices });

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
  const dateLabel = days.length ? formatDays(days) : date !== "all" ? DATE_FILTERS.find((f) => f.key === date)?.label : "";
  const regionLabel = sido ? `${sido}${gu ? ` ${gu}` : ""}` : "";
  const condition = [regionLabel, choices.genre ?? "", choices.format ?? "", q ? `‘${q}’` : "", dateLabel].filter(Boolean).join(" ");
  const summary = `${condition ? `${condition} ` : ""}모임 ${results.length}개${results.length > 0 ? " · 가까운 날짜순" : ""}`;
  // 검색어나 필터가 있으면 결과 보기 모드: 소개 글을 숨기고 날짜·필터를 두 버튼으로 모아 결과를 위로 올린다
  const searching = Boolean(q || sido || choices.genre || choices.format);
  // 고른 날 중 조건에 맞는 모임이 없는 날: 결과가 있으면 목록 안에 날짜 순서대로 한 줄씩 끼워 넣는다
  const emptyDays = days.filter((d) => !counts[d]);

  return (
    <div className="pt-5">
      {sp.bye === "1" && (
        <p role="status" className="mb-4 rounded-xs border border-info-border bg-info-surface px-3 py-2.5 text-b2 text-info">
          탈퇴가 끝났어요. 찜과 기록을 모두 지웠습니다. 그동안 고마웠어요.
        </p>
      )}
      {searching ? (
        <h1 className="sr-only">독서모임 검색 결과</h1>
      ) : (
        <section className="mb-5">
          <h1 className="font-display text-h1 text-ink">
            부엉이들이 여는
            <br />
            독서모임
          </h1>
          <p className="mt-2 text-b2 text-ink-2">서울·경기 동네책방에서 열리는 독서모임을 날짜별로 모아 뒀어요.</p>
        </section>
      )}

      {/* 신청 페이지를 열고 돌아오지 않아 표시를 놓친 모임을 한 번 더 묻는다(로그인 기능이 켜져 있을 때만) */}
      {wishes.enabled && <PendingApplies />}

      <FilterBar date={date} q={q} days={days} choices={choices} today={today} counts={counts} lastDay={lastDay} resultCount={results.length} summary={summary} searching={searching} />

      <section className="mt-1" aria-live="polite">
        {results.length > 0 ? (
          <>
            <MeetingList
              meetings={results}
              now={now}
              wishes={wishes}
              emptyDays={emptyDays}
              emptyLabel={searching ? "조건에 맞는 모임 없음" : "모임 없음"}
            />
          </>
        ) : (
          <div>
            <div className="rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
              <p className="text-t2 text-ink">{condition ? "해당 조건에 맞는" : "아직 올라온"} 모임이 없어요</p>
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
