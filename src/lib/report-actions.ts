"use server";

import { db, hasDb } from "@/lib/db";
import { clientIpHash } from "@/lib/client-hash";
import { getMeeting, isPast } from "@/lib/meetings";
import { REPORT_MESSAGE_MAX, isReportKind, type ReportResult } from "@/lib/report-kinds";
import { cleanupReportData } from "@/lib/reports";
import { getTrackContext } from "@/lib/tracking";

// 정보 오류·마감 신고 받기. 로그인 없이 누구나 보낼 수 있으므로
// - 내용은 글자로만 저장하고 길이를 자른다(신고함에서도 글자로만 보여 준다)
// - 같은 곳에서 짧은 시간에 여러 번 보내면 막고, 같은 신고를 연달아 보내면 한 번만 저장한다
//   (세기와 저장은 DB 함수 submit_report 가 잠금을 걸고 한 번에 한다: 0036. 한도 숫자도 그 안에 있다)

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
    const { data, error } = await db().rpc("submit_report", {
      p_meeting_id: meetingId,
      p_kind: input.kind,
      p_message: message,
      p_ip_hash: ipHash,
      p_visitor_id: visitorId.slice(0, 64),
    });
    if (error) throw new Error(error.message);
    if (data === "too_many") return { ok: false, reason: "too_many" };
    // 같은 신고를 연달아 보낸 경우('duplicate')는 이미 받았으므로 보낸 것으로 보여 준다
    if (data !== "ok" && data !== "duplicate") throw new Error(`unexpected submit_report result: ${String(data)}`);
    if (data === "ok") await cleanupReportData();
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
