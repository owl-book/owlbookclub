import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, LAST_PROVIDER_MAX_AGE, LOGIN_MAX_AGE, safeNext, signValue, verifyValue } from "@/lib/auth-shared";
import { LOGIN_COOKIE_OPTIONS, upsertUser } from "@/lib/auth";
import { PROVIDERS, exchangeCode, isProviderId, redirectUri } from "@/lib/oauth";
import { logEvent } from "@/lib/tracking";

type OAuthState = { state: string; next: string; provider: string };

// 처음 가입한 회원이 들를 환영 화면 주소.
// 찜·신청 표시를 누르다 가입했다면(/wish, /plan) 저장을 먼저 끝내고 환영 화면으로 오도록 저장 주소의 돌아갈 곳을 환영 화면으로 바꾼다.
// (환영 화면을 먼저 보여 주면 거기서 창을 닫았을 때 방금 누른 찜이 저장되지 않는다)
// done·id 를 앞에 둔다: 주소가 길어 safeNext 가 끝을 자르더라도 무엇을 저장했는지는 남도록
function welcomeDest(next: string): string {
  const url = new URL(next, "http://owl.local");
  const id = url.searchParams.get("id") ?? "";
  const done = url.pathname === "/wish" ? `wish-${url.searchParams.get("t")}` : url.pathname === "/plan" ? "plan" : null;
  if (!done) return `/welcome?next=${encodeURIComponent(next)}`;
  const back = safeNext(url.searchParams.get("next"));
  url.searchParams.set("next", `/welcome?${new URLSearchParams({ done, id, next: back })}`);
  return url.pathname + url.search;
}

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

    // 처음 가입한 회원은 원래 보던 페이지로 가기 전에 별명부터 정할 수 있게 한다
    const dest = user.isNew ? welcomeDest(next) : next;
    const res = NextResponse.redirect(new URL(dest, request.url), 302);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(AUTH_COOKIE.oauth, "", { path: "/auth", maxAge: 0 });
    res.cookies.set(AUTH_COOKIE.user, await signValue({ id: user.id, name, provider }, LOGIN_MAX_AGE), LOGIN_COOKIE_OPTIONS);
    res.cookies.set(AUTH_COOKIE.lastProvider, provider, { ...LOGIN_COOKIE_OPTIONS, maxAge: LAST_PROVIDER_MAX_AGE });
    return res;
  } catch (e) {
    console.error("[owl] login failed", provider, e);
    return fail("failed");
  }
}
