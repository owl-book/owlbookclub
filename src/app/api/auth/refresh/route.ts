import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_LOGIN_MAX_AGE, AUTH_COOKIE, signValue, verifyValue, type SessionUser } from "@/lib/auth-shared";
import { LOGIN_COOKIE_OPTIONS, isAuthEnabled } from "@/lib/auth";
import { db } from "@/lib/db";

// 홈 화면 앱의 로그인 늘리기. 앱을 열면 화면(KeepAppLogin)이 부른다.
// - 지금 로그인이 살아 있을 때만 늘린다(풀린 로그인을 되살리지 않음)
// - 하루에 한 번만 다시 서명한다(남은 기간이 1년에서 하루 이상 줄었을 때)
// - 탈퇴했거나 지워진 회원이면 늘리지 않는다
// 다른 사이트에서 이 주소를 불러도 로그인 쿠키가 실리지 않는다(sameSite=lax 는 다른 사이트의 POST 에 쿠키를 보내지 않음)
const DAY = 60 * 60 * 24;

export async function POST() {
  if (!isAuthEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const session = await verifyValue<SessionUser & { exp: number }>((await cookies()).get(AUTH_COOKIE.user)?.value);
  if (!session || typeof session.id !== "string") return NextResponse.json({ ok: false }, { status: 401 });

  const left = session.exp - Math.floor(Date.now() / 1000);
  if (left > APP_LOGIN_MAX_AGE - DAY) return NextResponse.json({ ok: true, renewed: false });

  const { data, error } = await db().from("users").select("id").eq("id", session.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true, renewed: true });
  res.cookies.set(
    AUTH_COOKIE.user,
    await signValue({ id: session.id, name: session.name, provider: session.provider }, APP_LOGIN_MAX_AGE),
    { ...LOGIN_COOKIE_OPTIONS, maxAge: APP_LOGIN_MAX_AGE },
  );
  return res;
}
