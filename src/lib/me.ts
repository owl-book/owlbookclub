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
  // 숨긴 모임은 찜 목록에서도 뺀다(상세 화면이 없으므로)
  return (data as unknown as { meeting: MeetingRow }[]).map((r) => meetingFromRow(r.meeting)).filter((m) => !m.hidden).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
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
  const upcoming = (rows as unknown as MeetingRow[]).map(meetingFromRow).filter((m) => !m.hidden);
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

// ─────────────────────────────────────────────
// 내 모임: 찜 → 책방에서 신청했어요 → 다녀왔어요(또는 못 갔어요)
// 부엉이서재는 신청을 받지 않는다. 여기 남는 것은 '본인이 책방에서 신청했다고 표시한 사실'뿐이고, 본인만 본다.
// ─────────────────────────────────────────────

export type Attended = "yes" | "no";

export type PlanState = { appliedAt: Date | null; attended: Attended | null };
export type Plan = PlanState & { meetingId: number; meeting: Meeting };

const PLAN_SELECT = "meeting_id, applied_at, attended";
type PlanRow = { meeting_id: number; applied_at: string | null; attended: Attended | null };

function planStateFromRow(r: PlanRow): PlanState {
  return { appliedAt: r.applied_at ? new Date(r.applied_at) : null, attended: r.attended };
}

// 게재를 내린 책방의 모임도 본인에게는 계속 보여 준다(화면에서는 글자로만)
export async function getPlans(userId: string): Promise<Plan[]> {
  const { data, error } = await db()
    .from("meeting_plans")
    .select(`${PLAN_SELECT}, meeting:meetings!inner(${MEETING_SELECT})`)
    .eq("user_id", userId)
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as unknown as (PlanRow & { meeting: MeetingRow })[]).map((r) => ({
    meetingId: r.meeting_id,
    ...planStateFromRow(r),
    meeting: meetingFromRow(r.meeting),
  }));
}

export async function getPlan(userId: string, meetingId: number): Promise<PlanState | null> {
  const { data, error } = await db().from("meeting_plans").select(PLAN_SELECT).eq("user_id", userId).eq("meeting_id", meetingId).maybeSingle();
  if (error) {
    // 0009 설정문 실행 전에도 상세 화면은 떠야 한다
    console.error("[owl] plan read failed", error.message);
    return null;
  }
  return data ? planStateFromRow(data as PlanRow) : null;
}

// 내 모임 저장. 회원 번호를 직접 받으므로 서버 안에서만 부른다(화면 동작 me-actions, 로그인 직후 표시 완료 /plan)
// - apply: true 면 신청 표시(이미 있으면 처음 시각 유지), false 면 표시 취소
// - attended: 모임 뒤 확인. 다녀왔어요는 신청 표시가 없어도 남길 수 있고, null 이면 확인 전으로 되돌린다
export async function savePlan(
  userId: string,
  meetingId: number,
  patch: { apply?: boolean; attended?: Attended | null },
) {
  const { data: m } = await db().from("meetings").select("store_id").eq("id", meetingId).maybeSingle();
  if (!m) throw new Error("모임을 찾을 수 없습니다.");
  const current = await getPlan(userId, meetingId);
  const next: PlanState = {
    appliedAt: patch.apply === undefined ? (current?.appliedAt ?? null) : patch.apply ? (current?.appliedAt ?? new Date()) : null,
    attended: patch.attended !== undefined ? patch.attended : (current?.attended ?? null),
  };

  // 남길 것이 하나도 없으면 줄을 지운다
  const { error } =
    !next.appliedAt && !next.attended
      ? await db().from("meeting_plans").delete().eq("user_id", userId).eq("meeting_id", meetingId)
      : await db().from("meeting_plans").upsert(
          {
            user_id: userId,
            meeting_id: meetingId,
            applied_at: next.appliedAt?.toISOString() ?? null,
            attended: next.attended,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,meeting_id" },
        );
  if (error) throw new Error(`내 모임 저장 실패: ${error.message}`);

  const action =
    patch.apply === true
      ? "apply"
      : patch.apply === false
        ? "unapply"
        : patch.attended === "yes"
          ? "attend_yes"
          : patch.attended === "no"
            ? "attend_no"
            : "attend_clear";
  await logEvent({
    type: "plan",
    userId,
    meetingId,
    storeId: m.store_id,
    props: { action },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 이 사람(로그인 회원 또는 이 기기)이 최근 신청 페이지를 열어 본 모임 번호. 신청 표시를 놓친 모임을 다시 묻는 데 쓴다.
export async function getClickedMeetingIds(who: { userId: string | null; visitorId: string | null }, since: Date): Promise<number[]> {
  const conds: string[] = [];
  if (who.userId && UUID_RE.test(who.userId)) conds.push(`user_id.eq.${who.userId}`);
  if (who.visitorId && UUID_RE.test(who.visitorId)) conds.push(`visitor_id.eq.${who.visitorId}`);
  if (conds.length === 0) return [];
  const { data, error } = await db()
    .from("events")
    .select("meeting_id")
    .eq("type", "apply_click")
    .gte("created_at", since.toISOString())
    .not("meeting_id", "is", null)
    .or(conds.join(","))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[owl] clicked meetings read failed", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((r) => r.meeting_id as number))];
}

export async function getMeetingsByIds(ids: number[]): Promise<Meeting[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db().from("meetings").select(MEETING_SELECT).in("id", ids.slice(0, 100));
  if (error) throw new Error(error.message);
  return (data as unknown as MeetingRow[]).map(meetingFromRow);
}

// '신청하셨나요?' 후보: 최근 14일 안에 신청 페이지를 열었고, 아직 열리지 않았고, 신청 표시가 없는 모임(최대 3개)
export const PENDING_CLICK_DAYS = 14;

export async function getPendingApplies(
  who: { userId: string | null; visitorId: string | null },
  appliedIds: Set<number>,
  now = new Date(),
): Promise<Meeting[]> {
  const ids = await getClickedMeetingIds(who, new Date(now.getTime() - PENDING_CLICK_DAYS * 86400000));
  const meetings = await getMeetingsByIds(ids.filter((id) => !appliedIds.has(id)));
  return meetings
    .filter((m) => !m.hidden && m.startsAt.getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 3);
}
