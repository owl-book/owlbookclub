import { NextResponse, type NextRequest } from "next/server";
import { isPushEnabled } from "@/lib/push";
import { runDailyDigest } from "@/lib/push-digest";
import { runAccountCleanup } from "@/lib/account-cleanup";
import { cronAuthorized } from "@/lib/cron-auth";

// 매일 아침 알림 보내기(+회원 정리). Vercel 이 정해진 시각(vercel.json)에 부르며, 출입 열쇠(CRON_SECRET)를 함께 실어 보낸다.
// 열쇠가 없거나 다르면 아무것도 하지 않는다(누구나 주소를 불러 알림을 보내게 하지 않으려고)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  // 회원 정리(카카오 연결 끊기 다시 시도·1년 지난 연결 끊김 회원 지우기)도 같은 때 돌린다. 실패해도 알림은 보낸다
  try {
    console.log("[owl] account cleanup", await runAccountCleanup());
  } catch (e) {
    console.error("[owl] account cleanup failed", (e as Error).message);
  }
  if (!isPushEnabled()) return NextResponse.json({ ok: false, reason: "push disabled" });
  try {
    const result = await runDailyDigest();
    console.log("[owl] push digest", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[owl] push digest failed", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
