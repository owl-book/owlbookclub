"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { DATE_FILTERS, dayKey, dayKeys, dayParts, formatDayNum, formatDays, mondayOf, type DateFilter } from "@/lib/time";
import { markListVisited } from "@/lib/nav-memory";
import type { Choices } from "@/lib/meetings";
import { REGIONS, SIDOS } from "@/lib/regions";
import { FORMATS, GENRES } from "@/lib/tags";
import { track } from "@/lib/track-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 날짜 버튼은 달력으로 한 번에 못 고르는 것만 둔다. '이번 주·다음 주'는 달력 화살표와 같아서 뺐다(예전 링크로 들어오면 그 버튼만 보인다).
const DATE_CHIPS: DateFilter[] = ["all", "this-weekend", "weekday-evening"];

function buildHref(date: DateFilter, q: string, days: number[], c: Choices) {
  const p = new URLSearchParams();
  if (c.sido) p.set("sido", c.sido);
  if (c.sido && c.gu) p.set("gu", c.gu);
  if (c.genre) p.set("genre", c.genre);
  if (c.format) p.set("format", c.format);
  if (days.length) p.set("day", dayKeys(days));
  else if (date !== "all") p.set("d", date);
  if (q.trim()) p.set("q", q.trim());
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

type Props = {
  date: DateFilter;
  q: string;
  days: number[]; // 달력에서 고른 날짜 번호들(작은 순)
  choices: Choices; // 필터 선택값(시·도, 구·시·군, 장르, 모임방식)
  today: number; // 서버가 정한 오늘(KST) — 화면 깜빡임 없이 서버·브라우저가 같은 달력을 그리도록
  counts: Record<number, number>; // 날짜 번호 → 검색어에 맞는 모임 수
  lastDay: number | null; // 가장 늦은 모임 날짜
  resultCount: number; // 지금 조건에 맞는 모임 수(필터 판의 '모임 N개 보기' 버튼)
  summary: string; // 목록 위 안내 글(예: '경기 문학 모임 1개 · 가까운 날짜순')
  searching: boolean; // 검색어나 필터가 있음 → 달력을 한 줄로 접어 결과를 위로 올린다
};

export function FilterBar({ date, q, days, choices, today, counts, lastDay, resultCount, summary, searching }: Props) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [calOpen, setCalOpen] = useState(false); // 결과 보기 모드에서 접힌 달력을 펼쳤는지
  const sheetRef = useRef<HTMLDialogElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const scrollAfterSearch = useRef(false);

  // 앞으로 넘겨 볼 수 있는 끝: 마지막 모임 날짜, 최소한 다음 주까지
  const maxDay = Math.max(lastDay ?? today, today + 13);
  const firstDay = days[0] ?? null;
  const [weekStart, setWeekStart] = useState(() => mondayOf(firstDay ?? today));
  const [month, setMonth] = useState(() => monthOf(firstDay ?? today));

  // 뒤로 가기 등으로 고른 날짜가 바뀌었는데 지금 달력에 하나도 안 보이면, 첫 날짜가 보이도록 달력을 옮긴다
  const daysKey = dayKeys(days);
  const [prevDaysKey, setPrevDaysKey] = useState(daysKey);
  if (daysKey !== prevDaysKey) {
    setPrevDaysKey(daysKey);
    const visible = days.some((d) => (expanded ? monthIndex(monthOf(d)) === monthIndex(month) : d >= weekStart && d < weekStart + 7));
    if (firstDay != null && !visible) {
      setWeekStart(mondayOf(firstDay));
      setMonth(monthOf(firstDay));
    }
  }

  // 로고·뒤로 가기 등으로 주소의 검색어가 바뀌면 검색칸도 그 검색어로 맞춘다(로고를 누르면 빈 칸)
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setText(q);
  }

  useEffect(markListVisited, []);

  // 검색을 마치면 'N개' 줄이 화면 위쪽에 오도록 내려가서 결과가 바뀐 걸 바로 보여준다
  useEffect(() => {
    if (pending || !scrollAfterSearch.current) return;
    scrollAfterSearch.current = false;
    const el = summaryRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 64 && top < window.innerHeight * 0.4) return; // 이미 잘 보이면 그대로
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [pending]);

  const { sido, gu } = choices;
  const pickedCount = [sido, choices.genre, choices.format].filter(Boolean).length;
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  // 필터 하나를 바꾸면 나머지 선택은 그대로 두고 다시 찾는다
  const pick = (change: Partial<Choices>) => {
    const next = { ...choices, ...change };
    const picked = Object.fromEntries(Object.entries(change).filter(([, v]) => v));
    if (Object.keys(picked).length) track("filter", { props: { ...picked, q: text.trim() } });
    go(buildHref(date, text, days, next));
  };

  // 날짜를 누를 때마다 넣었다 뺐다 한다(여러 날 고르기). 고른 날을 다시 누르면 그날만 빠진다
  const pickDay = (d: number) => {
    const picked = days.includes(d);
    const next = picked ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b);
    if (!picked) track("filter", { props: { day: dayKey(d), via: "calendar", picked: next.length, q: text.trim() } });
    go(buildHref("all", text, next, choices));
  };

  const cell = (d: number, outside = false) => (
    <DayCell key={d} day={d} today={today} count={counts[d] ?? 0} selected={days.includes(d)} outside={outside} onPick={pickDay} />
  );

  // 날짜 버튼(전체·이번 주말·평일 저녁). 결과 보기 모드에서는 날짜 판 안으로 들어간다
  const dateChips = (
    <div
      className={searching ? "flex flex-wrap gap-2 px-1 pt-2" : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"}
      role="group"
      aria-label="날짜 필터"
    >
      {DATE_FILTERS.filter((f) => DATE_CHIPS.includes(f.key) || (days.length === 0 && f.key === date)).map((f) => {
        const active = days.length === 0 && f.key === date;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              if (f.key !== "all") track("filter", { props: { date: f.key, q: text.trim() } });
              go(buildHref(f.key, text, [], choices));
            }}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-l1 ${
              active ? "border-navy bg-navy text-white" : "border-border bg-card text-ink-2 hover:border-border-strong"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  // 지역·장르·모임방식 필터 판을 여는 버튼. 결과 보기 모드에서는 날짜 버튼 옆에 놓인다(날짜 글자가 길어 날짜 버튼을 조금 더 넓게)
  const filterButton = (
    <button
      type="button"
      onClick={() => sheetRef.current?.showModal()}
      aria-haspopup="dialog"
      aria-label={pickedCount ? `지역·장르·모임방식 필터, ${pickedCount}개 선택됨` : "지역·장르·모임방식 필터"}
      className={`flex min-h-11 items-center gap-1.5 border text-l1 ${
        searching ? "min-w-0 flex-[2] rounded-sm px-3" : "shrink-0 rounded-full px-3"
      } ${
        pickedCount ? "border-navy font-semibold text-navy" : "border-border-control bg-card text-ink-2 hover:border-border-strong"
      }`}
    >
      <FilterIcon />
      필터
      {pickedCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-l2 text-white" aria-hidden>
          {pickedCount}
        </span>
      )}
    </button>
  );

  // 결과 보기 모드의 날짜 버튼·꼬리표에 보일 지금 고른 날짜(고르지 않았으면 null)
  const dateClearLabel = days.length ? formatDays(days) : date !== "all" ? (DATE_FILTERS.find((f) => f.key === date)?.label ?? null) : null;

  return (
    <div className="space-y-3" aria-busy={pending}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // 모바일 키보드 닫기
          if (text.trim()) track("search", { props: { q: text.trim(), date } });
          scrollAfterSearch.current = true;
          go(buildHref(date, text, days, choices));
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="지역, 책방 이름, 책 제목"
          aria-label="모임 검색"
          enterKeyHint="search"
          className="min-h-11 min-w-0 flex-1 rounded-xs border border-border-control bg-card px-3 py-2.5 text-b1 text-ink placeholder:text-ink-3 focus:border-navy"
        />
        <button type="submit" className="min-h-11 shrink-0 rounded-sm bg-navy px-4 text-l1 font-semibold text-white hover:bg-navy-hover active:bg-navy-active">
          검색
        </button>
      </form>

      {!searching && dateChips}

      <FilterSheet
        sheetRef={sheetRef}
        choices={choices}
        pick={pick}
        pickedCount={pickedCount}
        resultCount={resultCount}
        pending={pending}
      />

      {searching && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCalOpen(!calOpen)}
            aria-expanded={calOpen}
            aria-controls="date-panel"
            className={`flex min-h-11 min-w-0 flex-[3] items-center gap-1.5 rounded-sm border px-3 text-l1 ${
              dateClearLabel ? "border-navy font-semibold text-navy" : "border-border-control bg-card text-ink-2 hover:border-border-strong"
            }`}
          >
            <CalendarIcon />
            <span className="min-w-0 truncate">{dateClearLabel ?? "날짜"}</span>
            <span className="ml-auto shrink-0">
              <Chevron dir={calOpen ? "up" : "down"} size={20} />
            </span>
          </button>
          {filterButton}
        </div>
      )}

      {(!searching || calOpen) && (
        <div id="date-panel" className="rounded-md border border-border-card bg-card px-2 pb-2 pt-1">
          {searching && dateChips}
          {expanded ? (
            <>
              <CalendarNav
                title={`${month.year}년 ${month.month}월`}
                onPrev={() => setMonth(shiftMonth(month, -1))}
                onNext={() => setMonth(shiftMonth(month, 1))}
                prevDisabled={monthIndex(month) <= monthIndex(monthOf(today))}
                nextDisabled={monthIndex(month) >= monthIndex(monthOf(maxDay))}
                prevLabel="이전 달"
                nextLabel="다음 달"
              />
              <WeekHeader />
              <div className="grid grid-cols-7 gap-y-1">{monthDays(month).map((d) => cell(d, dayParts(d).month !== month.month))}</div>
            </>
          ) : (
            <>
              <CalendarNav
                title={weekTitle(weekStart, today)}
                onPrev={() => setWeekStart(weekStart - 7)}
                onNext={() => setWeekStart(weekStart + 7)}
                prevDisabled={weekStart <= mondayOf(today)}
                nextDisabled={weekStart >= mondayOf(maxDay)}
                prevLabel="이전 주"
                nextLabel="다음 주"
              />
              <WeekHeader />
              <div className="grid grid-cols-7">{Array.from({ length: 7 }, (_, i) => cell(weekStart + i))}</div>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              // 펼칠 때는 보고 있던 주의 달을, 접을 때는 고른 날(없으면 오늘)의 주를 보여준다
              if (expanded) setWeekStart(mondayOf(firstDay ?? today));
              else setMonth(monthOf(Math.max(weekStart, today)));
              setExpanded(!expanded);
            }}
            aria-expanded={expanded}
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 rounded-sm bg-sub text-l1 text-ink-2"
          >
            {expanded ? "달력 접기" : "한 달 달력 보기"}
            <Chevron dir={expanded ? "up" : "down"} size={20} />
          </button>
        </div>
      )}

      {/* 목록 바로 위: 지금 조건의 모임 수와 필터. 조건이 결과 바로 위에 있어야 왜 이 모임들만 보이는지 알 수 있다 */}
      <div ref={summaryRef} className="scroll-mt-16">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-l2 text-ink-3">{summary}</p>
          {!searching && filterButton}
        </div>
        {/* 고른 조건을 꼬리표로 보여주고, 누르면 그 조건만 지운다 */}
        {(pickedCount > 0 || (searching && dateClearLabel)) && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="선택한 필터">
            {searching && dateClearLabel && <RemoveTag label={dateClearLabel} onRemove={() => go(buildHref("all", text, [], choices))} />}
            {sido && <RemoveTag label={gu ? `${sido} ${gu}` : sido} onRemove={() => pick({ sido: null, gu: null })} />}
            {choices.genre && <RemoveTag label={choices.genre} onRemove={() => pick({ genre: null })} />}
            {choices.format && <RemoveTag label={choices.format} onRemove={() => pick({ format: null })} />}
          </div>
        )}
      </div>

      {/* 불러오는 중 표시: 높이를 미리 잡아 두어 화면이 밀리지 않게 */}
      <div className="h-0.5 overflow-hidden rounded-full" role="status">
        {pending && (
          <>
            <div className="owl-loading h-full w-1/3 rounded-full bg-navy" />
            <span className="sr-only">모임을 불러오는 중</span>
          </>
        )}
      </div>
    </div>
  );
}

// 아래에서 올라오는 필터 판. 고르는 즉시 목록에 반영하고, 아래 버튼에 맞는 모임 수를 보여준다.
function FilterSheet({
  sheetRef,
  choices,
  pick,
  pickedCount,
  resultCount,
  pending,
}: {
  sheetRef: React.RefObject<HTMLDialogElement | null>;
  choices: Choices;
  pick: (change: Partial<Choices>) => void;
  pickedCount: number;
  resultCount: number;
  pending: boolean;
}) {
  const { sido, gu, genre, format } = choices;
  const close = () => sheetRef.current?.close();
  return (
    <dialog
      ref={sheetRef}
      aria-labelledby="filter-sheet-title"
      className="owl-sheet bg-card text-ink"
      // 어두운 바깥을 누르면 닫는다
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-border py-1 pl-4 pr-1">
          <h2 id="filter-sheet-title" className="text-t2">
            필터
          </h2>
          <button type="button" onClick={close} aria-label="필터 닫기" className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-2 hover:text-navy">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-4 py-5">
          <ChoiceGroup title="지역">
            <Choice selected={!sido} onClick={() => pick({ sido: null, gu: null })}>
              전체
            </Choice>
            {SIDOS.map((s) => (
              // 시·도를 바꾸면 구·시·군은 다시 고르게 비운다
              <Choice key={s} selected={sido === s} onClick={() => pick({ sido: s, gu: null })}>
                {s}
              </Choice>
            ))}
          </ChoiceGroup>

          {/* 구·시·군은 시·도를 고른 뒤에만 보여준다 */}
          {sido && (
            <ChoiceGroup title={`${sido} 지역`}>
              <Choice selected={!gu} onClick={() => pick({ gu: null })}>
                {sido} 전체
              </Choice>
              {REGIONS[sido].map((g) => (
                <Choice key={g} selected={gu === g} onClick={() => pick({ gu: g })}>
                  {g}
                </Choice>
              ))}
            </ChoiceGroup>
          )}

          <ChoiceGroup title="장르">
            <Choice selected={!genre} onClick={() => pick({ genre: null })}>
              전체
            </Choice>
            {GENRES.map((g) => (
              <Choice key={g} selected={genre === g} onClick={() => pick({ genre: g })}>
                {g}
              </Choice>
            ))}
          </ChoiceGroup>

          <ChoiceGroup title="모임방식">
            <Choice selected={!format} onClick={() => pick({ format: null })}>
              전체
            </Choice>
            {FORMATS.map((f) => (
              <Choice key={f} selected={format === f} onClick={() => pick({ format: f })}>
                {f}
              </Choice>
            ))}
          </ChoiceGroup>
        </div>

        <div className="flex gap-2 border-t border-border px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            disabled={pickedCount === 0}
            onClick={() => pick({ sido: null, gu: null, genre: null, format: null })}
            className="min-h-11 shrink-0 rounded-sm border border-border-control px-4 text-l1 text-ink-2 disabled:border-border disabled:text-ink-3/50"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-11 flex-1 rounded-sm bg-navy px-4 text-l1 font-semibold text-white hover:bg-navy-hover active:bg-navy-active"
          >
            {pending ? "찾는 중…" : `모임 ${resultCount}개 보기`}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ChoiceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-l1 font-semibold text-ink">{title}</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={selected ? undefined : onClick}
      className={`min-h-11 rounded-full border px-4 text-l1 ${
        selected ? "border-navy bg-navy font-semibold text-white" : "border-border bg-card text-ink-2 hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

function RemoveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${label} 필터 지우기`}
      className="flex min-h-11 items-center gap-1 rounded-full border border-navy bg-card pl-3.5 pr-2.5 text-l1 font-semibold text-navy"
    >
      {label}
      <CloseIcon size={18} />
    </button>
  );
}

// 아이콘 가이드 v2.2: 24px 격자, 선 굵기 1.75
function FilterIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function DayCell({
  day,
  today,
  count,
  selected,
  outside,
  onPick,
}: {
  day: number;
  today: number;
  count: number;
  selected: boolean;
  outside: boolean;
  onPick: (d: number) => void;
}) {
  const past = day < today;
  const disabled = !selected && past; // 지난 날만 막는다. 모임 없는 날도 미리 골라 둘 수 있다
  const isToday = day === today;
  const label = `${formatDayNum(day)}${isToday ? ", 오늘" : ""}, ${count > 0 ? `모임 ${count}개` : "모임 없음"}`;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      onClick={() => onPick(day)}
      className={`mx-auto flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-sm text-[15px] ${
        selected
          ? "bg-navy font-semibold text-white"
          : disabled
            ? "text-ink-3/50"
            : count > 0
              ? "font-semibold text-ink"
              : "text-ink-2"
      } ${isToday && !selected ? "ring-1 ring-border-strong" : ""} ${outside && !selected ? "opacity-50" : ""}`}
    >
      <span className="leading-none">{dayParts(day).date}</span>
      {/* 모임 수만큼 점(최대 3개) */}
      <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-white" : "bg-navy"}`} />
        ))}
      </span>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        d="M5.5 6.5h13a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM4.5 10.5h15M8.5 4.5v4M15.5 4.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarNav(props: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  prevLabel: string;
  nextLabel: string;
}) {
  const arrow = "flex h-11 w-11 items-center justify-center rounded-sm text-ink-2 hover:text-navy disabled:text-ink-3/40";
  return (
    <div className="flex items-center justify-between">
      <button type="button" className={arrow} onClick={props.onPrev} disabled={props.prevDisabled} aria-label={props.prevLabel}>
        <Chevron dir="left" />
      </button>
      <p className="text-l1 font-semibold text-ink" aria-live="polite">
        {props.title}
      </p>
      <button type="button" className={arrow} onClick={props.onNext} disabled={props.nextDisabled} aria-label={props.nextLabel}>
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function WeekHeader() {
  return (
    <div className="grid grid-cols-7 pb-1 text-center text-l2 text-ink-3" aria-hidden>
      {WEEK_LABELS.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </div>
  );
}

// 아이콘 가이드 v2.2: 24px 격자, 선 굵기 1.75, 색은 글자색을 따른다(기본 ink-2, 활성 navy)
function Chevron({ dir, size = 24 }: { dir: "left" | "right" | "up" | "down"; size?: number }) {
  const rotate = { left: 180, right: 0, up: -90, down: 90 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 달력 계산 (날짜 번호 = KST 기준 1970-01-01부터 며칠째) ──

type Month = { year: number; month: number };

function monthOf(dayNum: number): Month {
  const p = dayParts(dayNum);
  return { year: p.year, month: p.month };
}

function monthIndex(m: Month) {
  return m.year * 12 + m.month - 1;
}

function shiftMonth(m: Month, by: number): Month {
  const i = monthIndex(m) + by;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

// 그 달을 덮는 월~일 주들의 날짜 번호 (앞뒤 달 날짜 포함)
function monthDays(m: Month): number[] {
  const first = Date.UTC(m.year, m.month - 1, 1) / DAY_MS;
  const last = Date.UTC(m.year, m.month, 0) / DAY_MS;
  const start = mondayOf(first);
  const end = mondayOf(last) + 6;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function weekTitle(weekStart: number, today: number): string {
  const diff = (weekStart - mondayOf(today)) / 7;
  if (diff === 0) return "이번 주";
  if (diff === 1) return "다음 주";
  const a = dayParts(weekStart);
  const b = dayParts(weekStart + 6);
  return `${a.month}월 ${a.date}일 – ${b.month === a.month ? "" : `${b.month}월 `}${b.date}일`;
}
