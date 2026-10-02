import "server-only";
import { db, hasDb } from "@/lib/db";
import { matchesRegion, type Sido } from "@/lib/regions";
import type { Format, Genre } from "@/lib/tags";
import { kstDayNumber, matchesDateFilter, type DateFilter } from "@/lib/time";

export type Meeting = {
  id: number;
  startsAt: Date;
  title: string;
  tagGenre: string;
  tagFormat: string;
  tagCadence: string;
  postUrl: string | null;
  applyUrl: string;
  bookTitle: string | null;
  bookAuthor: string | null;
  place: string | null;
  feeText: string | null;
  lastCheckedAt: string; // YYYY-MM-DD
  status: "open" | "closed";
  store: { id: number; name: string; region: string };
};

export function isPast(m: Meeting, now = new Date()): boolean {
  return m.startsAt.getTime() < now.getTime();
}

// 마이페이지(찜·기록)에서도 같은 모양으로 읽는다
// 모임 칸은 '*'로 읽는다: 저자 칸(book_author_text, 0004)을 DB에 추가하기 전에도 화면이 깨지지 않게
export const MEETING_SELECT =
  "*, store:stores!inner(id, name, region, is_blocked), book:books(author)";

export type MeetingRow = {
  id: number;
  starts_at: string;
  title: string;
  tag_genre: string;
  tag_format: string;
  tag_cadence: string;
  post_url: string | null;
  apply_url: string;
  book_title_text: string | null;
  book_author_text?: string | null; // 0004 실행 전에는 없음
  place: string | null;
  fee_text: string | null;
  last_checked_at: string;
  status: "open" | "closed";
  store: { id: number; name: string; region: string; is_blocked: boolean };
  book: { author: string | null } | null; // book_isbn 으로 연결된 책(없으면 null)
};

export function meetingFromRow(r: MeetingRow): Meeting {
  return {
    id: r.id,
    startsAt: new Date(r.starts_at),
    title: r.title,
    tagGenre: r.tag_genre,
    tagFormat: r.tag_format,
    tagCadence: r.tag_cadence,
    postUrl: r.post_url,
    applyUrl: r.apply_url,
    bookTitle: r.book_title_text,
    bookAuthor: r.book_author_text?.trim() || r.book?.author || null, // 직접 적은 저자 → 연결된 책의 저자 순
    place: r.place,
    feeText: r.fee_text,
    lastCheckedAt: r.last_checked_at,
    status: r.status,
    store: { id: r.store.id, name: r.store.name, region: r.store.region },
  };
}

// 게재 차단 책방은 모든 조회에서 제외
export async function getUpcomingMeetings(now = new Date()): Promise<Meeting[]> {
  if (!hasDb()) return demoMeetings(now).filter((m) => !isPast(m, now));
  const { data, error } = await db()
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("store.is_blocked", false)
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as unknown as MeetingRow[]).map(meetingFromRow);
}

export async function getRecentPastMeetings(now = new Date(), days = 30): Promise<Meeting[]> {
  if (!hasDb()) return demoMeetings(now).filter((m) => isPast(m, now));
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const { data, error } = await db()
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("store.is_blocked", false)
    .lt("starts_at", now.toISOString())
    .gte("starts_at", since.toISOString())
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as unknown as MeetingRow[]).map(meetingFromRow);
}

export async function getMeeting(id: number): Promise<Meeting | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!hasDb()) return demoMeetings(new Date()).find((m) => m.id === id) ?? null;
  const { data, error } = await db().from("meetings").select(MEETING_SELECT).eq("id", id).eq("store.is_blocked", false).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? meetingFromRow(data as unknown as MeetingRow) : null;
}

// 띄어쓰기·대소문자 차이를 무시하는 검색 정규화
export function normalize(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

// 검색 대상: 지역, 책방명, 게재 시 입력한 책 제목 텍스트 (+ 모임 제목)
export function matchesQuery(m: Meeting, q: string): boolean {
  const nq = normalize(q);
  if (!nq) return true;
  return [m.store.region, m.store.name, m.bookTitle ?? "", m.title].some((f) => normalize(f).includes(nq));
}

// 첫 화면 드롭박스 선택값(지역 2칸, 장르, 모임방식). 비어 있으면 그 조건은 보지 않는다
export type Choices = { sido: Sido | null; gu: string | null; genre: Genre | null; format: Format | null };

export function matchesChoices(m: Meeting, c: Choices): boolean {
  return (
    matchesRegion(m.store.region, c.sido, c.gu) &&
    (!c.genre || m.tagGenre === c.genre) &&
    (!c.format || m.tagFormat === c.format)
  );
}

// day(달력에서 고른 날짜 번호)가 있으면 날짜 버튼(date) 대신 그날만 본다
export function filterMeetings(
  meetings: Meeting[],
  opts: { date: DateFilter; q: string; now: Date; day?: number | null; choices: Choices },
): Meeting[] {
  return meetings.filter(
    (m) =>
      (opts.day != null ? kstDayNumber(m.startsAt) === opts.day : matchesDateFilter(m.startsAt, opts.date, opts.now)) &&
      matchesQuery(m, opts.q) &&
      matchesChoices(m, opts.choices),
  );
}

// 달력 점 표시용: 날짜 번호 → 그날 모임 수
export function countByDay(meetings: Meeting[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const m of meetings) {
    const d = kstDayNumber(m.startsAt);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}

// ── DB 연결 전 로컬 미리보기용 예시 데이터 ──
function demoMeetings(now: Date): Meeting[] {
  const at = (days: number, hour: number, min = 0) => {
    const d = new Date(now.getTime() + days * 86400000);
    // KST 기준 hour:min 으로 맞춤
    const kst = new Date(d.getTime() + 9 * 3600000);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), hour - 9, min));
  };
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); // KST 날짜
  const base = { postUrl: "https://www.instagram.com/", place: null, feeText: "1만5천원", lastCheckedAt: today, status: "open" as const };
  return [
    { ...base, id: 1, startsAt: at(1, 19, 30), title: "[예시] 목요 소설 읽기", tagGenre: "문학", tagFormat: "자유토론", tagCadence: "정기", applyUrl: "https://example.com/apply/1", bookTitle: "작별하지 않는다", bookAuthor: "한강", store: { id: 1, name: "부엉이책방", region: "경기 고양시" } },
    { ...base, id: 2, startsAt: at(3, 14), title: "[예시] 주말 과학책 한 권", tagGenre: "과학", tagFormat: "발제", tagCadence: "일일", applyUrl: "https://example.com/apply/2", bookTitle: "코스모스", bookAuthor: "칼 세이건", store: { id: 2, name: "골목서점", region: "서울 마포구" } },
    { ...base, id: 3, startsAt: at(6, 20), title: "[예시] 에세이 필사 모임", tagGenre: "에세이", tagFormat: "필사", tagCadence: "정기", applyUrl: "https://example.com/apply/3", bookTitle: "아무튼, 서재", bookAuthor: "김윤관", feeText: null, status: "closed", store: { id: 3, name: "책방 달빛", region: "경기 파주시" } },
    { ...base, id: 4, startsAt: at(9, 19), title: "[예시] 인문 고전 함께 읽기", tagGenre: "인문", tagFormat: "발제", tagCadence: "정기", applyUrl: "https://example.com/apply/4", bookTitle: "정의란 무엇인가", bookAuthor: "마이클 샌델", store: { id: 1, name: "부엉이책방", region: "경기 고양시" } },
    { ...base, id: 5, startsAt: at(-2, 19), title: "[예시] 지난 시 낭독회", tagGenre: "문학", tagFormat: "낭독", tagCadence: "일일", applyUrl: "https://example.com/apply/5", bookTitle: "입 속의 검은 잎", bookAuthor: "기형도", store: { id: 2, name: "골목서점", region: "서울 마포구" } },
  ];
}
