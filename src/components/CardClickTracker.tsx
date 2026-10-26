"use client";

import { useEffect } from "react";
import { track } from "@/lib/track-client";

// 목록(홈·책방·내 모임 등)에서 모임 카드를 눌러 상세 화면으로 가는 클릭을 우리 기록(어드민 '통계')에 남긴다.
// 카드마다 코드를 심지 않고 화면 전체에서 /m/{번호} 링크 클릭으로 알아본다. 모임 상세 안의 링크(회차 등)는 카드가 아니라 세지 않는다.
export function CardClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = location.pathname;
      if (path.startsWith("/admin") || path.startsWith("/m/")) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const match = url.pathname.match(/^\/m\/(\d+)$/);
      if (!match) return;
      track("card_click", { meetingId: Number(match[1]) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
