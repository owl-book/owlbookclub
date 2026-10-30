import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAccountCleanup } from "@/lib/account-cleanup";

// 회원 정리만 따로 돌리는 주소(점검·수동 실행용). 평소에는 매일 아침 알림(/api/cron/push)이 함께 돌린다.
// 출입 열쇠(CRON_SECRET)가 없거나 다르면 아무것도 하지 않는다
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const result = await runAccountCleanup();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[owl] account cleanup failed", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
