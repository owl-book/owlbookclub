import { NextResponse, type NextRequest } from "next/server";
import { logEvent, type EventType } from "@/lib/tracking";
import { clientIpHash } from "@/lib/client-hash";

// 브라우저에서 보내는 사용 이벤트(검색·필터·공유·신고 클릭·모임 카드 클릭·책방 화면 조회·책방 연락 클릭·검색 0건·사람 확인)
// 신청 클릭과 방문은 서버(/go, proxy)에서 직접 기록하므로 여기서 받지 않는다.
const ALLOWED: EventType[] = ["search", "filter", "share", "report_click", "card_click", "store_view", "store_contact", "search_empty", "page_seen"];

// 같은 곳에서 1분에 보낼 수 있는 이벤트 수(가짜 통계로 숫자를 부풀리는 것 방지). 서버 한 대 안에서만 세는 간단한 제한이라 완벽하진 않지만 대량 전송은 막는다
const PER_MINUTE = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function tooMany(key: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  const cur = hits.get(key);
  if (!cur || cur.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  cur.count += 1;
  return cur.count > PER_MINUTE;
}

export async function POST(request: NextRequest) {
  if (tooMany(await clientIpHash())) return NextResponse.json({ ok: false }, { status: 429 });
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
