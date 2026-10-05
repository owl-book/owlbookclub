// 모든 날짜 판단은 한국 시간(KST, UTC+9, 서머타임 없음) 기준

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateFilter = "all" | "this-week" | "this-weekend" | "next-week" | "weekday-evening";

export const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "this-week", label: "이번 주" },
  { key: "this-weekend", label: "이번 주말" },
  { key: "next-week", label: "다음 주" },
  { key: "weekday-evening", label: "평일 저녁" },
];

export function isDateFilter(v: unknown): v is DateFilter {
  return DATE_FILTERS.some((f) => f.key === v);
}

// KST 벽시계 값을 UTC 필드에 담은 Date (getUTC* 로 KST 요일·시각을 읽기 위함)
function toKstWall(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}

// 이번 주 월요일 00:00 KST 의 실제 시각
function startOfKstWeek(now: Date): number {
  const w = toKstWall(now);
  const dow = (w.getUTCDay() + 6) % 7; // 월=0 … 일=6
  const midnightWall = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - dow * DAY_MS;
  return midnightWall - KST_OFFSET_MS;
}

export function matchesDateFilter(startsAt: Date, filter: DateFilter, now: Date): boolean {
  const t = startsAt.getTime();
  const weekStart = startOfKstWeek(now);
  switch (filter) {
    case "all":
      return true;
    case "this-week":
      return t >= weekStart && t < weekStart + 7 * DAY_MS;
    case "this-weekend":
      return t >= weekStart + 5 * DAY_MS && t < weekStart + 7 * DAY_MS;
    case "next-week":
      return t >= weekStart + 7 * DAY_MS && t < weekStart + 14 * DAY_MS;
    case "weekday-evening": {
      const w = toKstWall(startsAt);
      const dow = w.getUTCDay();
      return dow >= 1 && dow <= 5 && w.getUTCHours() >= 18;
    }
  }
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "10월 8일 (수) 오후 7:30"
export function formatKst(d: Date): string {
  const w = toKstWall(d);
  const h = w.getUTCHours();
  const m = w.getUTCMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${w.getUTCMonth() + 1}월 ${w.getUTCDate()}일 (${WEEKDAYS[w.getUTCDay()]}) ${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

export function formatKstDateOnly(d: Date): string {
  const w = toKstWall(d);
  return `${w.getUTCMonth() + 1}월 ${w.getUTCDate()}일 (${WEEKDAYS[w.getUTCDay()]})`;
}

// "2026-10-01" 형식의 날짜 문자열 → "10월 1일"
export function formatDateString(s: string): string {
  const [, m, d] = s.split("-").map(Number);
  return `${m}월 ${d}일`;
}

// KST 기준 날짜 번호(같은 날이면 같은 값) — 목록의 날짜 묶음·"오늘/내일" 계산용
export function kstDayNumber(d: Date): number {
  return Math.floor((d.getTime() + KST_OFFSET_MS) / DAY_MS);
}

export function relativeDayLabel(d: Date, now: Date): string | null {
  const diff = kstDayNumber(d) - kstDayNumber(now);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  return null;
}

// "오후 7:30"
export function formatKstTime(d: Date): string {
  const w = toKstWall(d);
  const h = w.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}:${String(w.getUTCMinutes()).padStart(2, "0")}`;
}

// ── 달력용: KST 날짜 번호 ↔ 주소에 쓰는 "2026-10-08" ──

export function dayKey(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

export function parseDayKey(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t) || dayKey(t / DAY_MS) !== v) return null;
  return t / DAY_MS;
}

// 달력에서 여러 날을 고르면 주소에 "2026-10-08,2026-10-10"처럼 쉼표로 잇는다(예전 한 날짜 주소도 그대로 읽힌다)
const MAX_DAYS = 31;

export function parseDayKeys(v: unknown): number[] {
  if (typeof v !== "string") return [];
  const days = v
    .split(",")
    .slice(0, MAX_DAYS)
    .map(parseDayKey)
    .filter((d): d is number => d != null);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function dayKeys(days: number[]): string {
  return days.map(dayKey).join(",");
}

// 고른 날짜들을 짧게: "10월 10일 (토)" 또는 "10월 10일 (토) 외 2일"
export function formatDays(days: number[]): string {
  if (days.length === 0) return "";
  return days.length === 1 ? formatDayNum(days[0]) : `${formatDayNum(days[0])} 외 ${days.length - 1}일`;
}

// 날짜 번호의 년·월·일·요일(일=0)
export function dayParts(dayNum: number) {
  const d = new Date(dayNum * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate(), dow: d.getUTCDay() };
}

// 그 날짜가 속한 주의 월요일 날짜 번호
export function mondayOf(dayNum: number): number {
  return dayNum - ((dayParts(dayNum).dow + 6) % 7);
}

// "10월 8일 (수)"
export function formatDayNum(dayNum: number): string {
  const p = dayParts(dayNum);
  return `${p.month}월 ${p.date}일 (${WEEKDAYS[p.dow]})`;
}
