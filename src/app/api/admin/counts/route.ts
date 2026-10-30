import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getInboxCount } from "@/lib/reports";
import { readReviewCount } from "@/lib/review";

// 운영자 화면을 띄워 둔 동안 탭의 남은 일 수(승인 대기·신고함)만 다시 읽는다(AdminTabs 가 1분 30초마다 부름).
// 책 표지 수는 운영자가 직접 올릴 때만 바뀌어 여기서 읽지 않는다. 출입증이 없으면 숫자를 주지 않는다
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const [review, reports] = await Promise.all([readReviewCount(), getInboxCount()]);
  return NextResponse.json({ ok: true, review, reports }, { headers: { "Cache-Control": "no-store" } });
}
