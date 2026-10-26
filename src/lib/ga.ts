// 구글 애널리틱스(GA4) 이벤트 보내기. 측정 ID 가 없거나 GA 를 불러오지 않은 화면(관리자·운영자 기기)에서는 아무 일도 하지 않는다.
// 보내는 이벤트 이름 목록(홈 화면 클릭 측정, 2026-10-26 시작):
//   calendar_pick  주간·월간 달력에서 날짜 선택   view=week|month
//   month_open     '한 달 달력 보기' 열기          mode=home|search
//   filter_chip    날짜 칩·필터 판 선택            group=date|sido|gu|genre|format, value
//   search         검색 실행                       q(개인정보 가림), date
//   meeting_click  모임 카드·모임 링크 클릭        (GoogleAnalytics.tsx 가 /m/{id} 링크로 알아봄)
//   apply_click    신청 페이지·원 게시물 이동       (GoogleAnalytics.tsx, /go/{id})
//   apply_return   신청하러 갔다가 모임 화면으로 돌아옴
//   wish           하트 클릭                        kind, on, login_required
//   plan_add       '내 모임'에 담기                 source=detail|pending_prompt
//   plan_remove    '내 모임'에서 빼기
//   menu_open      메뉴(☰) 열기
//   menu_click     메뉴 항목 클릭                   item=모임|책방|전시
//   store_click    책방 링크 클릭                   (GoogleAnalytics.tsx)
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function gaEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  try {
    window.gtag?.("event", name, params);
  } catch {
    // 측정 실패가 화면 동작을 막으면 안 된다
  }
}

// 검색어에서 이메일·전화번호 같은 개인정보 모양을 가리고 50자까지만 보낸다
export function maskQuery(q: string): string {
  return q
    .trim()
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[가림]")
    .replace(/\d[\d\s-]{5,}\d/g, "[가림]")
    .slice(0, 50);
}
