import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-shared";

// 로그아웃: 우리 사이트의 로그인 쿠키만 지운다(각 회사 계정 로그인은 그대로)
export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(AUTH_COOKIE.user, "", { path: "/", maxAge: 0 });
  return res;
}
