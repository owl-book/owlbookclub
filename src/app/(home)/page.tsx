import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { HomeSlider } from "@/components/HomeSlider";
import { MeetingList } from "@/components/MeetingList";
import { PendingApplies } from "@/components/PendingApplies";
import { getWishContext } from "@/lib/me";
import { attachSeries, collapseSeries, countByDay, filterMeetings, getRecentPastMeetings, getUpcomingMeetings, isClosed, isPast, matchesChoices, matchesQuery, type Choices } from "@/lib/meetings";
import { isGuOf, isSido, regionChoicesOf } from "@/lib/regions";
import { listStoreOptions } from "@/lib/stores";
import { activeSlides } from "@/lib/slides";
import { isFormat, isGenre } from "@/lib/tags";
import { count, joinDotText } from "@/lib/format";
import { DATE_FILTERS, formatDays, isDateFilter, kstDayNumber, parseDayKeys } from "@/lib/time";

// 달력에서 뒤로 넘겨 볼 수 있는 지난 기간(일)
const PAST_CALENDAR_DAYS = 180;

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const now = new Date();
  const today = kstDayNumber(now);
  // 달력에서 고른 날짜들(지난 날은 달력이 보여 주는 범위까지만)
  const days = parseDayKeys(sp.day).filter((d) => d >= today - PAST_CALENDAR_DAYS);
  const date = days.length === 0 && isDateFilter(sp.d) ? sp.d : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const sido = isSido(sp.sido) ? sp.sido : null;
  const gu = sido && isGuOf(sido, sp.gu) ? sp.gu : null;
  const choices: Choices = { sido, gu, genre: isGenre(sp.genre) ? sp.genre : null, format: isFormat(sp.format) ? sp.format : null };
  const showPast = sp.past === "1";

  // 여러 회차를 한 번에 신청하는 모임은 날짜 조건 없는 목록에서만 가장 가까운 회차 한 장으로 접는다.
  // 달력 점·날짜를 고른 목록에는 모든 회차가 그 날짜에 보인다(지난 모임도 접지 않음)
  const [upcomingAll, pastAll, wishes, stores] = await Promise.all([
    getUpcomingMeetings(now).then(attachSeries),
    getRecentPastMeetings(now, PAST_CALENDAR_DAYS, 1000).then(attachSeries),
    getWishContext(),
    listStoreOptions(),
  ]);
  // 필터의 지역: 등록된 책방이 있는 지역만(지금 모집 중인 모임이 없어도 넣는다)
  const regions = regionChoicesOf(stores.map((s) => s.region));
  // 달력에서 날짜를 고르면 지난 모임까지 날짜순으로, 아니면 다가오는 모임만
  const upcoming = collapseSeries(upcomingAll);
  const pastAsc = [...pastAll].reverse();
  const pool = days.length ? [...pastAsc, ...upcomingAll] : date !== "all" ? upcomingAll : upcoming;
  const results = filterMeetings(pool, { date, q, now, days, choices });

  // 달력의 점: 날짜 조건은 빼고 검색어·필터만 반영한 모임 수(지난 날 점도 함께)
  const searched = upcoming.filter((m) => matchesQuery(m, q) && matchesChoices(m, choices));
  const searchedAll = upcomingAll.filter((m) => matchesQuery(m, q) && matchesChoices(m, choices));
  const counts = countByDay([...pastAsc.filter((m) => matchesQuery(m, q) && matchesChoices(m, choices)), ...searchedAll]);
  const lastDay = upcomingAll.length ? kstDayNumber(upcomingAll[upcomingAll.length - 1].startsAt) : null;
  // 뒤로 넘겨 볼 수 있는 끝: 가장 오래된 지난 모임 날짜
  const earliestDay = pastAsc.length ? kstDayNumber(pastAsc[0].startsAt) : null;

  // 빈 결과: 검색어는 유지한 채 가까운 다른 날짜 모임, 그래도 없으면 전체에서 가까운 모임
  let nearby: typeof upcoming = [];
  if (results.length === 0) {
    nearby = searched.slice(0, 3);
    if (nearby.length === 0) nearby = upcoming.slice(0, 3);
  }

  // 아래 '최근 30일 지난 모임'은 위에서 읽은 지난 모임에서 30일치만 쓴다
  // 검색어·필터가 있으면 지난 모임도 같은 조건으로 거른다
  const past = showPast
    ? pastAll.filter((m) => m.startsAt.getTime() >= now.getTime() - 30 * 86400000 && matchesQuery(m, q) && matchesChoices(m, choices)).slice(0, 100)
    : [];
  // '지난 모임 보기'는 지금 검색어·필터·날짜를 그대로 두고 past=1 만 더한다
  const pastParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "past" || key === "bye" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) pastParams.append(key, v);
  }
  pastParams.set("past", "1");
  const pastHref = `/?${pastParams.toString()}`;
  const dateLabel = days.length ? formatDays(days) : date !== "all" ? DATE_FILTERS.find((f) => f.key === date)?.label : "";
  const regionLabel = sido ? `${sido}${gu ? ` ${gu}` : ""}` : "";
  const condition = [regionLabel, choices.genre ?? "", choices.format ?? "", q ? `‘${q}’` : "", dateLabel].filter(Boolean).join(" ");
  // 마감 모임이 섞여 있으면 신청할 수 있는 수를 따로 알려 준다(지난 모임은 '마감'으로 세지 않음)
  const closedCount = results.filter((m) => isClosed(m, now)).length;
  const openCount = results.filter((m) => m.status === "open" && !isPast(m, now)).length;
  const summary = joinDotText(
    `${condition ? `${condition} ` : ""}모임 ${count(results.length, "개")}`,
    closedCount > 0 && `신청 가능 ${count(openCount, "개")}`,
    results.length > 0 && "가까운 날짜순",
  );
  // 검색어나 필터가 있으면 결과 보기 모드: 소개 글을 숨기고 날짜·필터를 두 버튼으로 모아 결과를 위로 올린다
  const searching = Boolean(q || sido || choices.genre || choices.format);
  // 고른 날 중 조건에 맞는 모임이 없는 날: 결과가 있으면 목록 안에 날짜 순서대로 한 줄씩 끼워 넣는다
  const emptyDays = days.filter((d) => !counts[d]);

  return (
    <div className="pt-3">
      {sp.bye === "1" && (
        <p role="status" className="mb-4 rounded-xs border border-info-border bg-info-surface px-3 py-2.5 text-b2 text-info">
          탈퇴가 끝났어요. 찜과 기록을 모두 지웠습니다. 그동안 고마웠어요.
        </p>
      )}
      {searching ? (
        <h1 className="sr-only">독서모임 검색 결과</h1>
      ) : (
        // 소개 글은 슬라이더 첫 장(제목이 이 화면의 h1)
        <HomeSlider slides={activeSlides(now)} />
      )}

      {/* 신청 페이지를 열고 돌아오지 않아 표시를 놓친 모임을 한 번 더 묻는다(로그인 기능이 켜져 있을 때만) */}
      {wishes.enabled && <PendingApplies />}

      {/* 슬라이더 첫 장 '독서모임 찾아보기'가 여기로 내려온다 */}
      <div id="meetings" className="scroll-mt-20" />
      <FilterBar regions={regions} date={date} q={q} days={days} choices={choices} today={today} counts={counts} lastDay={lastDay} earliestDay={earliestDay} resultCount={results.length} summary={summary} searching={searching} />

      <section aria-live="polite">
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
              <p className="mt-1 text-b2 text-ink-2">지금은 경기 동부 책방부터 모으고 있어요. 곧 더 넓힐게요.</p>
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
              <p className="text-b2 text-ink-2">{searching ? "조건에 맞는 지난 모임이 없습니다." : "지난 모임이 없습니다."}</p>
            ) : (
              <MeetingList meetings={past} now={now} wishes={wishes} />
            )}
          </>
        ) : (
          <Link href={pastHref} scroll={false} className="inline-flex min-h-11 items-center text-l1 text-ink-2 underline">
            지난 모임 보기
          </Link>
        )}
      </section>
    </div>
  );
}
