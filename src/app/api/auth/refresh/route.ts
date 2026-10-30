import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_LOGIN_MAX_AGE, AUTH_COOKIE, readSessionUser, signValue, verifyValue } from "@/lib/auth-shared";
import { LOGIN_COOKIE_OPTIONS, isAuthEnabled, liveUserRow, shownName } from "@/lib/auth";

// 홈 화면 앱의 로그인 늘리기. 앱을 열면 화면(KeepAppLogin)이 부른다.
// - 지금 로그인이 살아 있을 때만 늘린다(풀린 로그인을 되살리지 않음)
// - 하루에 한 번만 다시 서명한다(남은 기간이 1년에서 하루 이상 줄었을 때). 다른 기기에서 별명을 바꿨으면 그때도 새 이름으로 다시 서명
// - 탈퇴했거나 지워진 회원, 다른 기기에서 모두 로그아웃한 쿠키면 늘리지 않고 지운다(앱을 열 때마다 확인)
// 다른 사이트에서 이 주소를 불러도 로그인 쿠키가 실리지 않는다(sameSite=lax 는 다른 사이트의 POST 에 쿠키를 보내지 않음)
const DAY = 60 * 60 * 24;

export async function POST() {
  if (!isAuthEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = (await cookies()).get(AUTH_COOKIE.user)?.value;
  const session = await verifyValue<{ exp: number }>(raw);
  const user = await readSessionUser(raw);
  if (!session || !user) return NextResponse.json({ ok: false }, { status: 401 });

  // 다른 기기에서 '다른 기기 모두 로그아웃'을 눌렀거나 탈퇴했으면 이 기기의 로그인도 지운다(늘리는 날이 아니어도 확인)
  let row: Record<string, unknown> | null;
  try {
    row = await liveUserRow(user);
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!row) {
    const res = NextResponse.json({ ok: false }, { status: 401 });
    res.cookies.set(AUTH_COOKIE.user, "", { path: "/", maxAge: 0 });
    return res;
  }

  // 다른 기기에서 별명을 바꿨으면 이 기기의 로그인 쿠키에 든 이름도 새 별명으로 바꾼다
  const name = shownName(row, user.name);
  const left = session.exp - Math.floor(Date.now() / 1000);
  const renew = left <= APP_LOGIN_MAX_AGE - DAY;
  if (!renew && name === user.name) return NextResponse.json({ ok: true, renewed: false });

  // 늘리는 날이면 1년으로, 이름만 바뀌었으면 남은 기간 그대로 다시 서명한다
  const maxAge = renew ? APP_LOGIN_MAX_AGE : left;
  const res = NextResponse.json({ ok: true, renewed: renew, renamed: name !== user.name });
  res.cookies.set(AUTH_COOKIE.user, await signValue({ id: user.id, name, provider: user.provider, v: user.v }, maxAge), { ...LOGIN_COOKIE_OPTIONS, maxAge });
  return res;
}
