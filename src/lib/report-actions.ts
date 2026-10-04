"use server";

import { db, hasDb } from "@/lib/db";
import { clientIpHash } from "@/lib/client-hash";
import { getMeeting, isPast } from "@/lib/meetings";
import { REPORT_MESSAGE_MAX, isReportKind, type ReportResult } from "@/lib/report-kinds";
import { cleanupReportData } from "@/lib/reports";
import { getTrackContext } from "@/lib/tracking";

// 정보 오류·마감 신고 받기. 로그인 없이 누구나 보낼 수 있으므로
// - 내용은 글자로만 저장하고 길이를 자른다(신고함에서도 글자로만 보여 준다)
// - 같은 곳에서 짧은 시간에 여러 번 보내면 막는다(횟수는 DB에 센다: 서버가 수시로 새로 켜져도 유지)
const LIMITS = {
  per10min: 5, // 같은 곳에서 10분에 5건
  perDay: 20, // 같은 곳에서 하루 20건
  perMeetingPerDay: 3, // 같은 곳에서 같은 모임에 하루 3건
  allPerHour: 200, // 사이트 전체 1시간 200건(신고함이 장난 신고로 넘치지 않게)
};

export async function submitReport(input: { meetingId: number; kind: string; message: string; website?: string }): Promise<ReportResult> {
  if (!hasDb()) return { ok: false, reason: "failed" };
  // 사람 눈에는 안 보이는 칸. 자동 프로그램이 채우면 저장하지 않고 보낸 척만 한다
  if (input.website) return { ok: true };

  const meetingId = Number(input.meetingId);
  if (!isReportKind(input.kind) || !Number.isSafeInteger(meetingId) || meetingId <= 0) return { ok: false, reason: "invalid" };
  const message = cleanMessage(input.message);
  if (input.kind === "other" && !message) return { ok: false, reason: "invalid" };

  const meeting = await getMeeting(meetingId);
  if (!meeting || isPast(meeting)) return { ok: false, reason: "invalid" };

  try {
    const ipHash = await clientIpHash();
    const { visitorId } = await getTrackContext();
    if (await tooMany(ipHash, meetingId)) return { ok: false, reason: "too_many" };

    const { error } = await db()
      .from("reports")
      .insert({ meeting_id: meetingId, kind: input.kind, message, ip_hash: ipHash, visitor_id: visitorId.slice(0, 64) });
    if (error) throw new Error(error.message);
    await cleanupReportData();
    return { ok: true };
  } catch (e) {
    console.error("[owl] report failed", e);
    return { ok: false, reason: "failed" };
  }
}

function cleanMessage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // 줄바꿈·탭 말고 눈에 안 보이는 제어 문자는 뺀다
  const s = v.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, REPORT_MESSAGE_MAX);
  return s || null;
}

async function tooMany(ipHash: string, meetingId: number): Promise<boolean> {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  const base = () => db().from("reports").select("id", { count: "exact", head: true });
  const [tenMin, day, sameMeeting, all] = await Promise.all([
    count(base().eq("ip_hash", ipHash).gte("created_at", ago(10 * 60_000))),
    count(base().eq("ip_hash", ipHash).gte("created_at", ago(24 * 3600_000))),
    count(base().eq("ip_hash", ipHash).eq("meeting_id", meetingId).gte("created_at", ago(24 * 3600_000))),
    count(base().gte("created_at", ago(3600_000))),
  ]);
  return tenMin >= LIMITS.per10min || day >= LIMITS.perDay || sameMeeting >= LIMITS.perMeetingPerDay || all >= LIMITS.allPerHour;
}
