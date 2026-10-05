import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  COOKIE,
  HEADER,
  SESSION_MAX_AGE,
  YEAR,
  isBotUserAgent,
  isScraperUserAgent,
  parseUtm,
  type Utm,
} from "@/lib/tracking-shared";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { AUTH_COOKIE, readSessionUser } from "@/lib/auth-shared";

// 모든 페이지 요청에서 방문자·세션·첫 유입 UTM 쿠키를 '서버에서' 설정한다.
// (iOS Safari·인앱 브라우저의 JS 쿠키 수명 제한을 피하기 위해)
// 새 세션이 시작되면 visit 이벤트를 1건 남긴다 → 재방문율의 원천.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { searchParams, pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent");

  // 수집 프로그램은 페이지를 주지 않는다(경쟁 서비스의 모임·책방 정보 통째 수집 방지)
  if (isScraperUserAgent(ua)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const isPrefetch =
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");
  const isRsc = request.headers.has("rsc");
  const isBot = isBotUserAgent(ua) || request.method === "HEAD";

  const existingVid = request.cookies.get(COOKIE.visitor)?.value;
  const existingSid = request.cookies.get(COOKIE.session)?.value;
  const vid = existingVid ?? crypto.randomUUID();
  const sid = existingSid ?? crypto.randomUUID();
  const newSession = !existingSid;

  // 첫 유입 UTM: 이미 있으면 유지(first-touch)
  let utm = parseUtm(request.cookies.get(COOKIE.utm)?.value);
  let utmIsNew = false;
  if (!utm) {
    const source = searchParams.get("utm_source");
    utm = source
      ? {
          utm_source: source,
          utm_medium: searchParams.get("utm_medium") ?? undefined,
          utm_campaign: searchParams.get("utm_campaign") ?? undefined,
          utm_content: searchParams.get("utm_content") ?? undefined,
        }
      : { utm_source: "direct" };
    utmIsNew = true;
  }

  // 운영자 기기 표시: ?owl_internal=1 켜기, ?owl_internal=0 끄기
  const internalParam = searchParams.get("owl_internal");
  let internal = request.cookies.get(COOKIE.internal)?.value === "1";
  if (internalParam === "1") internal = true;
  if (internalParam === "0") internal = false;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HEADER.visitor, vid);
  requestHeaders.set(HEADER.session, sid);
  requestHeaders.set(HEADER.utm, JSON.stringify(utm));
  requestHeaders.set(HEADER.internal, internal ? "1" : "0");
  requestHeaders.set(HEADER.bot, isBot ? "1" : "0");

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // 봇에게는 쿠키를 심지 않는다(방문자 수 부풀림 방지)
  if (!isBot) {
    const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
    response.cookies.set(COOKIE.visitor, vid, { ...base, maxAge: YEAR });
    // 요청마다 세션 만료를 30분 연장
    response.cookies.set(COOKIE.session, sid, { ...base, maxAge: SESSION_MAX_AGE });
    if (utmIsNew) response.cookies.set(COOKIE.utm, JSON.stringify(utm), { ...base, maxAge: YEAR });
    if (internalParam === "1") response.cookies.set(COOKIE.internal, "1", { ...base, maxAge: YEAR * 5 });
    if (internalParam === "0") response.cookies.delete(COOKIE.internal);
  }

  // 관리자 화면은 방문 통계에 넣지 않는다
  const isPageLoad = request.method === "GET" && !isPrefetch && !isRsc && !pathname.startsWith("/api") && !pathname.startsWith("/admin");
  if (newSession && isPageLoad) {
    event.waitUntil(logVisit({ vid, sid, userCookie: request.cookies.get(AUTH_COOKIE.user)?.value, utm, internal, isBot, ua, path: pathname, referrer: request.headers.get("referer") }));
  }

  return response;
}

async function logVisit(v: {
  vid: string;
  sid: string;
  userCookie: string | undefined;
  utm: Utm;
  internal: boolean;
  isBot: boolean;
  ua: string | null;
  path: string;
  referrer: string | null;
}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return;
  // 로그인 사용자의 방문이면 회원 번호도 남긴다(로그인 사용자 재방문율용)
  const user = await readSessionUser(v.userCookie);
  try {
    await fetch(`${url}/rest/v1/events`, {
      method: "POST",
      // 새 방식 secret 키(sb_secret_…)는 apikey 헤더로만 보낸다(Bearer 로 보내면 거절됨). 예전 service_role 키도 이 방식으로 동작
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        visitor_id: v.vid,
        session_id: v.sid,
        ...(user ? { user_id: user.id } : {}),
        type: "visit",
        path: v.path,
        ...v.utm,
        referrer: v.referrer?.slice(0, 500) ?? null,
        user_agent: v.ua?.slice(0, 500) ?? null,
        is_bot: v.isBot,
        is_internal: v.internal,
      }),
    });
  } catch (e) {
    console.error("[owl] visit log failed", e);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
