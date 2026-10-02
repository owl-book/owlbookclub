import { NextResponse, type NextRequest } from "next/server";
import { getMeeting, isPast } from "@/lib/meetings";
import { logEvent } from "@/lib/tracking";

// 신청 클릭 리다이렉트: 서버에서 기록한 뒤 책방 페이지로 보낸다.
// /go/{id}            → 신청 페이지
// /go/{id}?to=post    → 원 게시물
// 계획서 정의상 '신청 클릭' = 원 게시물·신청 페이지 링크 클릭이므로 둘 다 apply_click 으로 남기고 target 으로 구분.
// 중복(같은 세션·같은 모임)은 원본을 모두 남기고 집계 뷰에서 제거한다.
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const meeting = await getMeeting(Number(id));
  if (!meeting) return NextResponse.redirect(new URL("/", request.url), 302);

  const target = request.nextUrl.searchParams.get("to") === "post" && meeting.postUrl ? "post" : "apply";
  const destination = target === "post" ? meeting.postUrl! : meeting.applyUrl;

  await logEvent({
    type: "apply_click",
    meetingId: meeting.id,
    storeId: meeting.store.id,
    path: `/go/${meeting.id}`,
    props: { target, status: meeting.status, past: isPast(meeting) },
  });

  const res = NextResponse.redirect(destination, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

// 링크 미리보기 봇 등의 HEAD 요청은 기록하지 않고 같은 곳으로만 보낸다
export async function HEAD(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const meeting = await getMeeting(Number(id));
  return NextResponse.redirect(meeting ? meeting.applyUrl : new URL("/", request.url), 302);
}
