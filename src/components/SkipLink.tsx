"use client";

import { usePathname } from "next/navigation";

// 키보드로 들어오면 Tab 첫 번째로 나타나는 '건너뛰기' 링크(마우스·터치에는 보이지 않는다).
// 홈은 머리글·광고 슬라이더를 건너 모임 검색칸 바로 앞(#meetings)으로, 다른 화면은 본문(#content)으로 간다
export function SkipLink() {
  const home = usePathname() === "/";
  return (
    <a
      href={home ? "#meetings" : "#content"}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-xs focus:border focus:border-navy focus:bg-page focus:px-4 focus:text-l1 focus:text-navy"
    >
      {home ? "모임 찾기로 건너뛰기" : "본문으로 건너뛰기"}
    </a>
  );
}
