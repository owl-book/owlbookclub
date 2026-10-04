import "server-only";
import { db } from "@/lib/db";

// 신고함에 보여 줄 정보. 보낸 사람을 구분하는 값(ip_hash, visitor_id)은 읽지 않는다.

export type InboxReport = { id: number; kind: string; message: string | null; createdAt: Date };

export type InboxMeeting = {
  id: number;
  title: string;
  startsAt: Date;
  storeName: string;
  place: string | null;
  feeText: string | null;
  status: "open" | "closed";
  hidden: boolean;
  lastCheckedAt: string;
};

export type InboxItem = { meeting: InboxMeeting; reports: InboxReport[] };

export type HandledItem = { id: number; meetingId: number; meetingTitle: string; action: string; createdAt: Date };

type ReportRow = {
  id: number;
  kind: string;
  message: string | null;
  created_at: string;
  meeting: {
    id: number;
    title: string;
    starts_at: string;
    place: string | null;
    fee_text: string | null;
    status: "open" | "closed";
    is_hidden?: boolean;
    last_checked_at: string;
    store: { name: string; is_blocked: boolean };
  };
};

// 처리 전 신고를 모임별로 묶는다. 가장 최근에 신고가 들어온 모임이 위로
export async function getReportInbox(): Promise<InboxItem[]> {
  const { data, error } = await db()
    .from("reports")
    .select("id, kind, message, created_at, meeting:meetings!inner(*, store:stores!inner(name, is_blocked))")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const byMeeting = new Map<number, InboxItem>();
  for (const r of data as unknown as ReportRow[]) {
    const m = r.meeting;
    let item = byMeeting.get(m.id);
    if (!item) {
      item = {
        meeting: {
          id: m.id,
          title: m.title,
          startsAt: new Date(m.starts_at),
          storeName: m.store.name,
          place: m.place,
          feeText: m.fee_text,
          status: m.status,
          hidden: Boolean(m.is_hidden || m.store.is_blocked),
          lastCheckedAt: m.last_checked_at,
        },
        reports: [],
      };
      byMeeting.set(m.id, item);
    }
    item.reports.push({ id: r.id, kind: r.kind, message: r.message, createdAt: new Date(r.created_at) });
  }
  return [...byMeeting.values()];
}

export async function getRecentHandled(limit = 10): Promise<HandledItem[]> {
  const { data, error } = await db()
    .from("admin_actions")
    .select("id, meeting_id, action, created_at, meeting:meetings(title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as { id: number; meeting_id: number; action: string; created_at: string; meeting: { title: string } | null }[]).map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    meetingTitle: r.meeting?.title ?? `모임 ${r.meeting_id}`,
    action: r.action,
    createdAt: new Date(r.created_at),
  }));
}

// 보관 기간 지난 정보 지우기(개인정보처리방침 3번과 짝):
// - 신고의 보낸 곳 구분값: 7일 뒤 비움
// - 처리 끝난 신고: 6개월 뒤 삭제
// - 관리자 비밀번호 시도 기록: 하루 뒤 삭제
// 따로 예약 작업을 두지 않고, 신고가 들어오거나 관리자가 들어올 때마다 함께 정리한다.
export async function cleanupReportData(): Promise<void> {
  const ago = (days: number) => new Date(Date.now() - days * 24 * 3600_000).toISOString();
  const results = await Promise.all([
    db().from("reports").update({ ip_hash: null, visitor_id: null }).lt("created_at", ago(7)).not("ip_hash", "is", null),
    db().from("reports").delete().eq("status", "done").lt("resolved_at", ago(183)),
    db().from("admin_login_attempts").delete().lt("created_at", ago(1)),
  ]);
  for (const r of results) if (r.error) console.error("[owl] report cleanup failed", r.error.message);
}
