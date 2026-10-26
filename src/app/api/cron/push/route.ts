import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPushEnabled } from "@/lib/push";
import { runDailyDigest } from "@/lib/push-digest";

// 매일 아침 알림 보내기. Vercel 이 정해진 시각(vercel.json)에 부르며, 출입 열쇠(CRON_SECRET)를 함께 실어 보낸다.
// 열쇠가 없거나 다르면 아무것도 하지 않는다(누구나 주소를 불러 알림을 보내게 하지 않으려고)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
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
