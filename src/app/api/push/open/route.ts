import { NextResponse, type NextRequest } from "next/server";
import { hasDb } from "@/lib/db";
import { markOpened } from "@/lib/push";

// 알림을 눌러 열었다는 표시(서비스 워커가 보냄). 알림마다 붙은 추측하기 어려운 번호로만 표시하고, 다른 것은 받지 않는다
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let id: unknown;
  try {
    id = ((await request.json()) as { id?: unknown }).id;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof id !== "string" || !UUID.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  if (hasDb()) await markOpened(id);
  return NextResponse.json({ ok: true });
}
