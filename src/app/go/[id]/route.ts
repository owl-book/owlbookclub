import { NextResponse, type NextRequest } from "next/server";
import { getMeeting, isPast } from "@/lib/meetings";
import { logEvent } from "@/lib/tracking";
import { isSameSiteReferer } from "@/lib/tracking-shared";

// 신청 클릭 리다이렉트: 서버에서 기록한 뒤 책방 페이지로 보낸다.
// /go/{id}            → 신청 페이지
// /go/{id}?to=post    → 원 게시물
// /go/{id}?ok=1       → 마감된 모임이라고 알린 뒤 '그래도 책방 페이지로 가기'를 고른 경우
// 계획서 정의상 '신청 클릭' = 원 게시물·신청 페이지 링크 클릭이므로 둘 다 apply_click 으로 남기고 target 으로 구분.
// 중복(같은 세션·같은 모임)은 원본을 모두 남기고 집계 뷰에서 제거한다.
// 우리 화면(모임 상세 등)에서 누른 것만 사람의 클릭으로 센다. 바깥에서 이 주소로 곧바로 들어온 것은 링크를 두드리는 프로그램으로 보고 봇으로 남긴다.
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const meeting = await getMeeting(Number(id));
  if (!meeting) return NextResponse.redirect(new URL("/", request.url), 302);

  const target = request.nextUrl.searchParams.get("to") === "post" && meeting.postUrl ? "post" : "apply";

  // 열어 둔 화면이 예전 모습이라 신청 버튼이 남아 있었어도, 누른 순간의 상태로 한 번 더 확인한다.
  // 지난 모임은 상세 화면으로 돌려보내고, 마감된 모임은 상세 화면에서 '그래도 책방 페이지로 갈까요?'를 묻는다(추가 모집·대기 신청이 있을 수 있어 막지는 않음).
  // 돌려보낸 것은 신청 클릭으로 세지 않는다. 원 게시물 보기는 안내 글이라 그대로 보낸다
  if (target === "apply") {
    const past = isPast(meeting);
    if (past || (meeting.status === "closed" && request.nextUrl.searchParams.get("ok") !== "1")) {
      const back = new URL(`/m/${meeting.id}`, request.url);
      if (!past) back.searchParams.set("closed", "1");
      const res = NextResponse.redirect(back, 302);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
  }
  const destination = target === "post" ? meeting.postUrl! : meeting.applyUrl;

  await logEvent({
    type: "apply_click",
    meetingId: meeting.id,
    storeId: meeting.store.id,
    path: `/go/${meeting.id}`,
    props: { target, status: meeting.status, past: isPast(meeting) },
    isBot: !isSameSiteReferer(request.headers.get("referer"), request.nextUrl.host),
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
