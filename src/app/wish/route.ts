import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-shared";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { saveWish } from "@/lib/me";

// 로그인 전에 하트를 누른 경우: /wish?t=meeting&id=3&next=/m/3
// 로그인 안 됨 → 로그인 화면(돌아올 곳 = 이 주소) → 로그인 후 다시 여기로 와서 찜을 '켜기만' 하고 원래 화면으로.
// (끄기는 하지 않으므로 누가 이 링크를 보내도 찜이 지워지지 않는다)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const next = safeNext(sp.get("next"));
  const kind = sp.get("t");
  const id = Number(sp.get("id"));
  const back = NextResponse.redirect(new URL(next, request.url), 303);
  back.headers.set("Cache-Control", "no-store");

  if (!isAuthEnabled() || (kind !== "meeting" && kind !== "store") || !Number.isSafeInteger(id) || id <= 0) return back;

  const user = await getCurrentUser();
  if (!user) {
    const self = `/wish?t=${kind}&id=${id}&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(self)}&reason=wish`, request.url), 303);
  }

  try {
    await saveWish(user.id, kind, id, true);
  } catch (e) {
    console.error("[owl] wish after login failed", e);
  }
  return back;
}
