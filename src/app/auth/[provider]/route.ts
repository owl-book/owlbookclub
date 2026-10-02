import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, safeNext, signValue } from "@/lib/auth-shared";
import { isAuthEnabled } from "@/lib/auth";
import { PROVIDERS, isProviderId, isProviderReady, redirectUri } from "@/lib/oauth";

const STATE_MAX_AGE = 60 * 10;

// 로그인 시작: 위조 방지값(state)과 돌아갈 주소를 쿠키에 잠깐 담고 각 회사 로그인 화면으로 보낸다
export async function GET(request: NextRequest, ctx: RouteContext<"/auth/[provider]">) {
  const { provider } = await ctx.params;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!isProviderId(provider) || !isProviderReady(provider) || !isAuthEnabled()) {
    return NextResponse.redirect(new URL(`/login?error=unavailable&next=${encodeURIComponent(next)}`, request.url), 302);
  }

  const state = crypto.randomUUID();
  const url = PROVIDERS[provider].authorizeUrl({
    clientId: PROVIDERS[provider].clientId()!,
    redirectUri: redirectUri(request.nextUrl.origin, provider),
    state,
  });

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(AUTH_COOKIE.oauth, await signValue({ state, next, provider }, STATE_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: STATE_MAX_AGE,
  });
  return res;
}
