import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, readSessionUser, safeNext } from "@/lib/auth-shared";
import { goneLoginPath, isLiveSession } from "@/lib/auth";

// 더 이상 통하지 않는 로그인 쿠키(탈퇴·다른 기기 로그아웃)를 지우고 로그인 화면으로 보낸다.
// 마이페이지 화면은 쿠키를 직접 지울 수 없어서 이 주소를 거친다.
// 다른 사이트가 이 주소를 열게 해도 멀쩡한 로그인은 지우지 않는다(정말 통하지 않을 때만 지움)
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const user = await readSessionUser(request.cookies.get(AUTH_COOKIE.user)?.value);
  const live = user ? await isLiveSession(user).catch(() => true) : false;
  const res = NextResponse.redirect(new URL(live ? next : goneLoginPath(next), request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  if (user && !live) res.cookies.set(AUTH_COOKIE.user, "", { path: "/", maxAge: 0 });
  return res;
}
