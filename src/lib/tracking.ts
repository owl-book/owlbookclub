import "server-only";
import { headers } from "next/headers";
import { db, hasDb } from "@/lib/db";
import { HEADER, isBotUserAgent, parseUtm } from "@/lib/tracking-shared";
import { getCurrentUser } from "@/lib/auth";

export type EventType = "visit" | "search" | "filter" | "share" | "apply_click" | "report_click" | "post_click" | "login" | "wish" | "record" | "plan";

type TrackContext = {
  visitorId: string;
  sessionId: string;
  utm: ReturnType<typeof parseUtm>;
  isInternal: boolean;
  isBot: boolean;
  userAgent: string | null;
  referrer: string | null;
};

// proxy.ts 가 요청 헤더에 넣어둔 방문자 정보를 읽는다
export async function getTrackContext(): Promise<TrackContext> {
  const h = await headers();
  const ua = h.get("user-agent");
  return {
    visitorId: h.get(HEADER.visitor) ?? "unknown",
    sessionId: h.get(HEADER.session) ?? "unknown",
    utm: parseUtm(h.get(HEADER.utm)),
    isInternal: h.get(HEADER.internal) === "1",
    isBot: h.get(HEADER.bot) === "1" || isBotUserAgent(ua),
    userAgent: ua,
    referrer: h.get("referer"),
  };
}

export async function logEvent(input: {
  type: EventType;
  meetingId?: number | null;
  storeId?: number | null;
  path?: string | null;
  props?: Record<string, unknown>;
  isBot?: boolean;
  userId?: string | null; // 지정하지 않으면 로그인 쿠키에서 읽는다
}) {
  if (!hasDb()) return;
  const ctx = await getTrackContext();
  const userId = input.userId !== undefined ? input.userId : ((await getCurrentUser())?.id ?? null);
  const { error } = await db()
    .from("events")
    .insert({
      visitor_id: ctx.visitorId,
      session_id: ctx.sessionId,
      // 로그인했을 때만 보낸다: DB에 user_id 칸을 추가하기 전에 배포돼도 비로그인 기록은 계속 쌓이도록
      ...(userId ? { user_id: userId } : {}),
      type: input.type,
      meeting_id: input.meetingId ?? null,
      store_id: input.storeId ?? null,
      path: input.path ?? null,
      props: input.props ?? {},
      utm_source: ctx.utm?.utm_source ?? "direct",
      utm_medium: ctx.utm?.utm_medium ?? null,
      utm_campaign: ctx.utm?.utm_campaign ?? null,
      utm_content: ctx.utm?.utm_content ?? null,
      referrer: ctx.referrer?.slice(0, 500) ?? null,
      user_agent: ctx.userAgent?.slice(0, 500) ?? null,
      is_bot: input.isBot || ctx.isBot,
      is_internal: ctx.isInternal,
    });
  if (error) console.error("[owl] event log failed", input.type, error.message);
}
