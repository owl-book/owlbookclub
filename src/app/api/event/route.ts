import { NextResponse, type NextRequest } from "next/server";
import { logEvent, type EventType } from "@/lib/tracking";

// 브라우저에서 보내는 사용 이벤트(검색·필터·공유·신고 클릭)
// 신청 클릭과 방문은 서버(/go, proxy)에서 직접 기록하므로 여기서 받지 않는다.
const ALLOWED: EventType[] = ["search", "filter", "share", "report_click"];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const b = body as { type?: string; meetingId?: unknown; storeId?: unknown; path?: unknown; props?: unknown };
  if (!ALLOWED.includes(b.type as EventType)) return NextResponse.json({ ok: false }, { status: 400 });

  const toId = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
  const props = b.props && typeof b.props === "object" && !Array.isArray(b.props) ? (b.props as Record<string, unknown>) : {};
  // 검색어 등이 과도하게 길면 자른다
  const safeProps = Object.fromEntries(
    Object.entries(props).slice(0, 10).map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 100) : v]),
  );

  await logEvent({
    type: b.type as EventType,
    meetingId: toId(b.meetingId),
    storeId: toId(b.storeId),
    path: typeof b.path === "string" ? b.path.slice(0, 200) : null,
    props: safeProps,
  });
  return NextResponse.json({ ok: true });
}
