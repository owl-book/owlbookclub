import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, LOGIN_MAX_AGE, safeNext, signValue, verifyValue } from "@/lib/auth-shared";
import { LOGIN_COOKIE_OPTIONS, upsertUser } from "@/lib/auth";
import { PROVIDERS, exchangeCode, isProviderId, redirectUri } from "@/lib/oauth";
import { logEvent } from "@/lib/tracking";

type OAuthState = { state: string; next: string; provider: string };

// 각 회사 로그인 화면에서 돌아오는 곳: 회원 확인 → 로그인 쿠키 → 원래 보던 페이지로
export async function GET(request: NextRequest, ctx: RouteContext<"/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const saved = await verifyValue<OAuthState>(request.cookies.get(AUTH_COOKIE.oauth)?.value);
  const next = safeNext(saved?.next);

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, request.url), 302);
    res.cookies.set(AUTH_COOKIE.oauth, "", { path: "/auth", maxAge: 0 });
    return res;
  };

  // 사용자가 동의 화면에서 '취소'를 누른 경우
  if (sp.get("error")) return fail("cancelled");

  const code = sp.get("code");
  const state = sp.get("state");
  if (!isProviderId(provider) || !code || !state || !saved || saved.state !== state || saved.provider !== provider) {
    return fail("expired");
  }

  try {
    const accessToken = await exchangeCode(provider, { code, state, redirectUri: redirectUri(request.nextUrl.origin, provider) });
    const profile = await PROVIDERS[provider].profile(accessToken);
    const user = await upsertUser(provider, profile);
    const name = user.displayName || profile.nickname?.slice(0, 20) || `${PROVIDERS[provider].label} 사용자`;

    await logEvent({ type: "login", userId: user.id, path: `/auth/${provider}`, props: { provider, new_user: user.isNew } });

    const res = NextResponse.redirect(new URL(next, request.url), 302);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(AUTH_COOKIE.oauth, "", { path: "/auth", maxAge: 0 });
    res.cookies.set(AUTH_COOKIE.user, await signValue({ id: user.id, name, provider }, LOGIN_MAX_AGE), LOGIN_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    console.error("[owl] login failed", provider, e);
    return fail("failed");
  }
}
