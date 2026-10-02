import "server-only";
import { db } from "@/lib/db";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-shared";
import { logEvent } from "@/lib/tracking";
import { MEETING_SELECT, meetingFromRow, type Meeting, type MeetingRow } from "@/lib/meetings";

// 마이페이지 데이터: 찜(책방·모임)과 다녀온 모임 기록.
// 모든 조회는 로그인한 본인의 user_id 로만 거른다 — 기록은 비공개라 다른 사람 것을 꺼낼 길을 만들지 않는다.

export type Profile = {
  id: string;
  provider: string;
  nickname: string | null; // 로그인한 회사의 별명
  displayName: string | null; // 사용자가 직접 정한 별명
  createdAt: Date;
};

export type WishedStore = {
  id: number;
  name: string;
  region: string;
  instagramUrl: string | null;
  upcoming: Meeting[];
};

export type MeetingRecord = {
  meetingId: number;
  rating: number | null;
  quote: string | null;
  memo: string | null;
  updatedAt: Date;
};

export type RecordWithMeeting = MeetingRecord & { meeting: Meeting };

// 화면의 하트 버튼에 쓰는 내 찜 목록. 로그인 기능이 꺼져 있으면 enabled=false → 하트를 숨긴다.
export type WishContext = {
  enabled: boolean;
  user: SessionUser | null;
  meetingIds: Set<number>;
  storeIds: Set<number>;
};

export async function getWishContext(): Promise<WishContext> {
  const empty = { meetingIds: new Set<number>(), storeIds: new Set<number>() };
  if (!isAuthEnabled()) return { enabled: false, user: null, ...empty };
  const user = await getCurrentUser();
  if (!user) return { enabled: true, user: null, ...empty };
  // 찜 표가 아직 없을 때(설정문 실행 전)도 화면은 떠야 하므로 오류는 빈 목록으로 처리
  const [m, s] = await Promise.all([
    db().from("meeting_wishes").select("meeting_id").eq("user_id", user.id),
    db().from("store_wishes").select("store_id").eq("user_id", user.id),
  ]);
  if (m.error || s.error) console.error("[owl] wish ids failed", m.error?.message ?? s.error?.message);
  return {
    enabled: true,
    user,
    meetingIds: new Set((m.data ?? []).map((r) => r.meeting_id as number)),
    storeIds: new Set((s.data ?? []).map((r) => r.store_id as number)),
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  // display_name 칸이 아직 없을 수도 있어 기본 정보와 따로 읽는다
  const { data, error } = await db().from("users").select("id, provider, nickname, created_at").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const extra = await db().from("users").select("display_name").eq("id", userId).maybeSingle();
  return {
    id: data.id,
    provider: data.provider,
    nickname: data.nickname,
    displayName: extra.data?.display_name ?? null,
    createdAt: new Date(data.created_at),
  };
}

export async function getWishedMeetings(userId: string): Promise<Meeting[]> {
  const { data, error } = await db()
    .from("meeting_wishes")
    .select(`created_at, meeting:meetings!inner(${MEETING_SELECT})`)
    .eq("user_id", userId)
    .eq("meeting.store.is_blocked", false)
    .limit(300);
  if (error) throw new Error(error.message);
  return (data as unknown as { meeting: MeetingRow }[]).map((r) => meetingFromRow(r.meeting)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export async function getWishedStores(userId: string, now = new Date()): Promise<WishedStore[]> {
  const { data, error } = await db()
    .from("store_wishes")
    .select("created_at, store:stores!inner(id, name, region, instagram_url, is_blocked)")
    .eq("user_id", userId)
    .eq("store.is_blocked", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const stores = (data as unknown as { store: { id: number; name: string; region: string; instagram_url: string | null } }[]).map((r) => r.store);
  if (stores.length === 0) return [];

  // 찜한 책방들의 다가오는 모임을 한 번에 읽어 책방별로 나눈다
  const { data: rows, error: mErr } = await db()
    .from("meetings")
    .select(MEETING_SELECT)
    .in("store_id", stores.map((s) => s.id))
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(300);
  if (mErr) throw new Error(mErr.message);
  const upcoming = (rows as unknown as MeetingRow[]).map(meetingFromRow);
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    instagramUrl: s.instagram_url,
    upcoming: upcoming.filter((m) => m.store.id === s.id),
  }));
}

const RECORD_SELECT = "meeting_id, rating, quote, memo, updated_at";
type RecordRow = { meeting_id: number; rating: number | null; quote: string | null; memo: string | null; updated_at: string };

function recordFromRow(r: RecordRow): MeetingRecord {
  return { meetingId: r.meeting_id, rating: r.rating, quote: r.quote, memo: r.memo, updatedAt: new Date(r.updated_at) };
}

// 기록은 모임이 나중에 차단 책방이 되어도 본인에게는 계속 보여준다(내 기록이므로)
export async function getRecords(userId: string): Promise<RecordWithMeeting[]> {
  const { data, error } = await db()
    .from("meeting_records")
    .select(`${RECORD_SELECT}, meeting:meetings!inner(${MEETING_SELECT})`)
    .eq("user_id", userId)
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as unknown as (RecordRow & { meeting: MeetingRow })[])
    .map((r) => ({ ...recordFromRow(r), meeting: meetingFromRow(r.meeting) }))
    .sort((a, b) => b.meeting.startsAt.getTime() - a.meeting.startsAt.getTime());
}

export async function getRecord(userId: string, meetingId: number): Promise<MeetingRecord | null> {
  const { data, error } = await db()
    .from("meeting_records")
    .select(RECORD_SELECT)
    .eq("user_id", userId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) {
    console.error("[owl] record read failed", error.message);
    return null;
  }
  return data ? recordFromRow(data as RecordRow) : null;
}

// 기록용 모임 조회: 차단 여부와 관계없이(이미 기록한 모임을 다시 열 수 있도록)
export async function getMeetingForRecord(meetingId: number): Promise<Meeting | null> {
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0) return null;
  const { data, error } = await db().from("meetings").select(MEETING_SELECT).eq("id", meetingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? meetingFromRow(data as unknown as MeetingRow) : null;
}

// 찜 저장. 회원 번호를 직접 받으므로 서버 안에서만 부른다(하트 버튼 동작 setWish, 로그인 직후 찜 완료 /wish)
export async function saveWish(userId: string, kind: "meeting" | "store", id: number, on: boolean) {
  const table = kind === "meeting" ? "meeting_wishes" : "store_wishes";
  const col = kind === "meeting" ? "meeting_id" : "store_id";
  const { error } = on
    ? await db().from(table).upsert({ user_id: userId, [col]: id }, { onConflict: `user_id,${col}`, ignoreDuplicates: true })
    : await db().from(table).delete().eq("user_id", userId).eq(col, id);
  if (error) throw new Error(`찜 저장 실패: ${error.message}`);

  let storeId: number | null = kind === "store" ? id : null;
  if (kind === "meeting") {
    const { data } = await db().from("meetings").select("store_id").eq("id", id).maybeSingle();
    storeId = data?.store_id ?? null;
  }
  await logEvent({
    type: "wish",
    userId,
    meetingId: kind === "meeting" ? id : null,
    storeId,
    props: { target: kind, on },
  });
}
