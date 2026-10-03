import type { ReactNode } from "react";

// 화면 맨 아래에 붙어 있는 행동 띠(상세화면의 찜 + 신청 버튼). 본문 폭(max-w-xl)에 맞추고,
// 아이폰 홈 막대 영역만큼 아래를 띄운다. 푸터가 가려지지 않도록 globals.css 의 .owl-action-bar 규칙과 짝을 이룬다.
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="owl-action-bar fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
