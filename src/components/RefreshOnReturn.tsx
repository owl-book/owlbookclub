"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// 화면을 오래 열어 둔 채 다른 앱에 갔다가 돌아오면 지금 화면을 조용히 다시 읽는다.
// 그사이 마감·숨김된 모임, 다른 기기에서 바꾼 찜이 예전 모습으로 남지 않게 하려는 것(아이폰 홈 화면 앱은 며칠씩 닫지 않고 쓴다).
// - 1분 넘게 떠나 있었을 때만: 잠깐 탭을 바꾼 정도로는 다시 읽지 않는다
// - 뒤로 가기로 브라우저가 저장해 둔 화면을 그대로 꺼내 보여 줄 때(bfcache)도 다시 읽는다
// - 무언가 입력하는 중이거나 확인 창이 떠 있으면 건너뛴다(쓰던 글·고르던 것 보호)
// - 운영자 화면은 숫자를 따로 다시 읽고(AdminTabs), 고치던 내용이 많아 건너뛴다
// 다시 읽어도 목록 위치·입력한 값 같은 화면 상태는 남고, 서버가 준 내용만 바뀐다. 방문 수는 화면 쪽에서 세지 않아 늘지 않는다
const AWAY_MS = 60_000;

export function RefreshOnReturn() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;

    const busy = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
      if (el instanceof HTMLElement && el.isContentEditable) return true;
      return document.querySelector('[aria-modal="true"]') !== null;
    };
    const refresh = () => {
      if (!busy()) router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= AWAY_MS) refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, router]);

  return null;
}
