import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-shared";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getMeetingForRecord, savePlan } from "@/lib/me";
import { isPast } from "@/lib/meetings";

// 로그인 전에 '책방에서 신청했어요'를 누른 경우: /plan?id=3&next=/m/3
// 로그인 안 됨 → 로그인 화면(돌아올 곳 = 이 주소) → 로그인 후 다시 여기로 와서 신청 표시를 '켜기만' 하고 원래 화면으로.
// (끄기는 하지 않으므로 누가 이 링크를 보내도 표시가 지워지지 않는다)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const next = safeNext(sp.get("next"));
  const id = Number(sp.get("id"));
  const back = NextResponse.redirect(new URL(next, request.url), 303);
  back.headers.set("Cache-Control", "no-store");

  if (!isAuthEnabled() || !Number.isSafeInteger(id) || id <= 0) return back;

  const user = await getCurrentUser();
  if (!user) {
    const self = `/plan?id=${id}&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(self)}&reason=plan`, request.url), 303);
  }

  try {
    const meeting = await getMeetingForRecord(id);
    if (meeting && !meeting.hidden && !isPast(meeting)) {
      await savePlan(user.id, id, { apply: true });
    }
  } catch (e) {
    console.error("[owl] plan after login failed", e);
  }
  return back;
}
