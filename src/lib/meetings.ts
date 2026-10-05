import "server-only";
import { cache } from "react";
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
  description: string | null;
  place: string | null;
  feeText: string | null;
  lastCheckedAt: string; // YYYY-MM-DD
  status: "open" | "closed";
  store: { id: number; name: string; region: string; address: string | null };
  // 게재를 내린 모임(모임 숨김 또는 책방 차단). 공개 화면에는 아예 나오지 않고, 내 모임·기록에서만 글자로 남는다
  hidden?: boolean;
};

export function isPast(m: Meeting, now = new Date()): boolean {
  return m.startsAt.getTime() < now.getTime();
}

// 마이페이지(찜·기록)에서도 같은 모양으로 읽는다
// 모임·책방 칸은 '*'로 읽는다: 저자 칸(book_author_text, 0004)·주소 칸(address, 0007)·모임 소개 칸(description, 0008)을 DB에 추가하기 전에도 화면이 깨지지 않게
export const MEETING_SELECT =
  "*, store:stores!inner(*), book:books(author)";

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
  description?: string | null; // 0008 실행 전에는 없음
  place: string | null;
  fee_text: string | null;
  last_checked_at: string;
  status: "open" | "closed";
  is_hidden?: boolean; // 0010 실행 전에는 없음
  store: { id: number; name: string; region: string; address?: string | null; is_blocked: boolean }; // address: 0007 실행 전에는 없음
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
    description: r.description?.trim() || null,
    place: r.place,
    feeText: r.fee_text,
    lastCheckedAt: r.last_checked_at,
    status: r.status,
    store: { id: r.store.id, name: r.store.name, region: r.store.region, address: r.store.address?.trim() || null },
    hidden: Boolean(r.is_hidden || r.store.is_blocked),
  };
}

// 게재 차단 책방과 숨긴 모임은 모든 공개 조회에서 제외.
// 숨김(is_hidden)은 DB 조건 대신 읽은 뒤 거른다: 0010 설정문 실행 전에 배포돼도 화면이 깨지지 않게
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
  return (data as unknown as MeetingRow[]).map(meetingFromRow).filter((m) => !m.hidden);
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
  return (data as unknown as MeetingRow[]).map(meetingFromRow).filter((m) => !m.hidden);
}

// cache: 한 번 화면을 그리는 동안(탭 제목 만들기 + 본문) 같은 모임을 DB에서 두 번 읽지 않는다
export const getMeeting = cache(async function getMeeting(id: number): Promise<Meeting | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!hasDb()) return demoMeetings(new Date()).find((m) => m.id === id) ?? null;
  const { data, error } = await db().from("meetings").select(MEETING_SELECT).eq("id", id).eq("store.is_blocked", false).maybeSingle();
  if (error) throw new Error(error.message);
  const m = data ? meetingFromRow(data as unknown as MeetingRow) : null;
  return m && !m.hidden ? m : null;
});

// 책방 상세: 한 책방의 모임을 since 이후로 모두(지난 모임 포함) 읽는다
export async function getMeetingsSince(since: Date, opts: { storeId: number }): Promise<Meeting[]> {
  const { data, error } = await db()
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("store_id", opts.storeId)
    .eq("store.is_blocked", false)
    .gte("starts_at", since.toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as unknown as MeetingRow[]).map(meetingFromRow).filter((m) => !m.hidden);
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

// days(달력에서 고른 날짜 번호들)가 있으면 날짜 버튼(date) 대신 그 날들만 본다
export function filterMeetings(
  meetings: Meeting[],
  opts: { date: DateFilter; q: string; now: Date; days?: number[]; choices: Choices },
): Meeting[] {
  const days = new Set(opts.days ?? []);
  return meetings.filter(
    (m) =>
      (days.size > 0 ? days.has(kstDayNumber(m.startsAt)) : matchesDateFilter(m.startsAt, opts.date, opts.now)) &&
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
export function demoMeetings(now: Date): Meeting[] {
  const at = (days: number, hour: number, min = 0) => {
    const d = new Date(now.getTime() + days * 86400000);
    // KST 기준 hour:min 으로 맞춤
    const kst = new Date(d.getTime() + 9 * 3600000);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), hour - 9, min));
  };
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); // KST 날짜
  const base = { postUrl: "https://www.instagram.com/", description: null, place: null, feeText: "1만5천원", lastCheckedAt: today, status: "open" as const };
  return [
    { ...base, id: 1, startsAt: at(1, 19, 30), description: "한 달에 한 권, 소설 속 마음에 남은 장면을 함께 이야기해요. 처음 오셔도 편하게 들으실 수 있어요.\n\n진행 순서\n1. 간단한 자기소개\n2. 인상 깊은 문장 나누기\n3. 발제 질문으로 자유 토론\n\n- 책은 미리 읽어 와 주세요\n- 음료 1잔이 포함돼요\n- 끝나고 다음 달 책을 함께 골라요\n\n모임은 2시간 정도 걸리고, 마치면 책방 둘러보기 시간이 있어요. 늦게 오셔도 괜찮으니 편하게 들어와 주세요.", title: "[예시] 목요 소설 읽기", tagGenre: "문학", tagFormat: "토론", tagCadence: "정기", applyUrl: "https://example.com/apply/1", bookTitle: "작별하지 않는다", bookAuthor: "한강", store: { id: 1, name: "부엉이책방", region: "경기 고양시", address: "경기 고양시 일산동구 정발산로 24 2층" } },
    { ...base, id: 2, startsAt: at(3, 14), title: "[예시] 주말 과학책 한 권", tagGenre: "과학", tagFormat: "토론", tagCadence: "일일", applyUrl: "https://example.com/apply/2", bookTitle: "코스모스", bookAuthor: "칼 세이건", store: { id: 2, name: "골목서점", region: "서울 마포구", address: null } },
    { ...base, id: 3, startsAt: at(6, 20), title: "[예시] 에세이 필사 모임", tagGenre: "에세이", tagFormat: "필사", tagCadence: "정기", applyUrl: "https://example.com/apply/3", bookTitle: "아무튼, 서재", bookAuthor: "김윤관", feeText: null, status: "closed", store: { id: 3, name: "책방 달빛", region: "경기 파주시", address: "경기 파주시 회동길 145" } },
    { ...base, id: 4, startsAt: at(9, 19), place: "책방 2층 세미나실", title: "[예시] 인문 고전 함께 읽기", tagGenre: "인문", tagFormat: "함께읽기", tagCadence: "정기", applyUrl: "https://example.com/apply/4", bookTitle: "정의란 무엇인가", bookAuthor: "마이클 샌델", store: { id: 1, name: "부엉이책방", region: "경기 고양시", address: "경기 고양시 일산동구 정발산로 24 2층" } },
    { ...base, id: 5, startsAt: at(-2, 19), title: "[예시] 지난 시 낭독회", tagGenre: "문학", tagFormat: "낭독", tagCadence: "일일", applyUrl: "https://example.com/apply/5", bookTitle: "입 속의 검은 잎", bookAuthor: "기형도", store: { id: 2, name: "골목서점", region: "서울 마포구", address: null } },
  ];
}
