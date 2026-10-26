import { dayKey, kstDayNumber } from "@/lib/time";

// 홈 맨 위 광고 슬라이더에 넣는 장들. 순서대로 보여 준다.
// 장을 더하거나 문구를 바꾸면 배포해야 반영된다(유료 광고가 생기면 DB 표 + 승인 화면으로 옮길 것).
// 제목은 아네모네 글꼴이라 가운뎃점(·)을 쓰지 않는다. 줄바꿈은 \n(설명은 쉼표 뒤에서 줄을 바꾼다)

// 그림의 밝기에 맞춘 글자색: navy 는 어두운 그림 위 흰 글씨, cream·sky 는 밝은 그림 위 진한 글씨
export type SlideTone = "navy" | "cream" | "sky";

export type Slide = {
  id: string; // GA banner_click 의 slide 값. 바꾸면 지난 숫자와 이어지지 않는다
  tone: SlideTone;
  // 배경 그림(public/ 아래 경로). 가로:세로 2.8:1(2000×714), 화면이 좁으면 오른쪽을 고정하고 왼쪽부터 잘린다.
  // 그래서 주인공은 오른쪽 45% 안에, 오른쪽 아래 1/4은 넘김 버튼 자리라 비워 두고, 글이 올라가는 왼쪽은 고른 톤으로 그린다
  image: string;
  title: string;
  body: string;
  beta?: boolean; // 장 오른쪽 위 모서리에 BETA 표시
  note?: string; // 넓은 화면에서만 설명 아래 한 줄 더(휴대폰은 장이 길어져 그림이 잘려서 뺀다)
  pageTitle?: boolean; // 이 장의 제목을 홈 화면의 제목(h1)으로 쓴다(한 장만)
  href?: string; // 없으면 누르는 곳 없는 안내 장. '#meetings' 는 홈 아래 모임 목록으로 내려간다
  cta?: string; // 누르는 곳의 글자(href 가 있을 때)
  hideWhenInstalled?: boolean; // 홈 화면 앱으로 연 사람에게는 감춘다
  startsOn?: string; // 'YYYY-MM-DD'(한국 날짜), 이날부터 보임
  endsOn?: string; // 'YYYY-MM-DD'(한국 날짜), 이날까지 보임
};

export const SLIDES: Slide[] = [
  {
    id: "intro",
    tone: "navy",
    image: "/slides/intro.webp",
    title: "오늘은 어떤\n책 모임에 가볼까요?",
    body: "동네책방 모임소식을 한곳에서 찾고,\n내 일정에 맞게 골라보세요.",
    pageTitle: true,
    href: "#meetings",
    cta: "독서모임 찾아보기",
  },
  {
    id: "app",
    tone: "cream",
    image: "/slides/app.webp",
    title: "관심 있는 모임,\n알림으로 만나세요",
    body: "휴대폰에 설치하고,\n새로운 소식을 받아보세요.",
    href: "/app",
    cta: "앱 설치하고 알림 받기",
    hideWhenInstalled: true,
  },
  {
    id: "register",
    tone: "sky",
    image: "/slides/register.webp",
    title: "우리 책방의 모임도\n소개하고 싶다면",
    body: "더 많은 독자에게 닿도록,\n부엉이들의 서재가 함께할게요.",
    href: "/contact?as=suggest",
    cta: "우리 책방도 소개하기",
  },
];

// 오늘(한국 날짜) 보여 줄 장들
export function activeSlides(now = new Date()): Slide[] {
  const today = dayKey(kstDayNumber(now));
  return SLIDES.filter((s) => (!s.startsOn || s.startsOn <= today) && (!s.endsOn || today <= s.endsOn));
}
