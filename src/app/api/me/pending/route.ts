import { NextResponse } from "next/server";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getPendingApplies, getPlans } from "@/lib/me";
import { getTrackContext } from "@/lib/tracking";
import { formatKst } from "@/lib/time";

// 첫 화면의 '신청하셨나요?' 안내용: 이 사람(로그인 회원 또는 이 기기)이 최근 신청 페이지를 열어 본, 아직 표시하지 않은 모임.
// 본인 쿠키로만 찾으므로 다른 사람의 기록은 돌려주지 않는다.
export async function GET() {
  const empty = NextResponse.json({ loggedIn: false, items: [] }, { headers: { "Cache-Control": "no-store" } });
  if (!isAuthEnabled()) return empty;
  try {
    const [user, ctx] = await Promise.all([getCurrentUser(), getTrackContext()]);
    if (ctx.isBot) return empty;
    const plans = user ? await getPlans(user.id) : [];
    const applied = new Set(plans.filter((p) => p.appliedAt).map((p) => p.meetingId));
    const meetings = await getPendingApplies({ userId: user?.id ?? null, visitorId: ctx.visitorId }, applied);
    return NextResponse.json(
      {
        loggedIn: Boolean(user),
        items: meetings.map((m) => ({ id: m.id, title: m.title, storeName: m.store.name, when: formatKst(m.startsAt) })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    // 0009 설정문 실행 전 등: 안내만 안 보이면 된다
    console.error("[owl] pending applies failed", e);
    return empty;
  }
}
