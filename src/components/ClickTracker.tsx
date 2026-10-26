"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setCurrentPath } from "@/lib/nav-memory";
import { track } from "@/lib/track-client";

// 화면 전체에서 링크 클릭을 우리 기록(어드민 '통계')에 남긴다. 부품마다 코드를 심지 않고 링크 모양으로 알아본다.
// - 모임 카드: 목록(홈·책방·내 모임 등)에서 /m/{번호} 링크를 누르면 card_click. 모임 상세 안의 링크(회차 등)는 카드가 아니라 세지 않는다
// - 책방 연락: data-owl-contact(map|tel|instagram)·data-owl-store 를 단 링크를 누르면 store_contact (책방·모임·전시 화면)
// 지금 보는 주소도 기억해 둔다 → 책방 화면 조회(StoreViewTracker)가 '어디서 왔는지'를 알 수 있다
// 사람 확인(page_seen): 화면이 브라우저에서 실제로 그려졌다는 신호. 대부분의 자동 프로그램은 화면을 그리지 않아 이 신호가 없다.
//   DB 지표(v_events_clean)는 이 신호가 있는 세션만 센다. 세션은 30분 쉬면 끝나므로 25분마다 한 번만 다시 보낸다.
const SEEN_KEY = "owl_seen_at";
const SEEN_EVERY_MS = 25 * 60 * 1000;

export function ClickTracker() {
  const pathname = usePathname();

  useEffect(() => {
    setCurrentPath(pathname);
    if (pathname.startsWith("/admin")) return;
    try {
      const last = Number(localStorage.getItem(SEEN_KEY) ?? 0);
      if (Date.now() - last < SEEN_EVERY_MS) return;
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // 저장소가 막힌 브라우저는 화면마다 보낸다(중복은 집계에 영향 없음)
    }
    track("page_seen");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = location.pathname;
      if (path.startsWith("/admin")) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;

      const contact = a.dataset.owlContact;
      const storeId = Number(a.dataset.owlStore);
      if (contact && Number.isSafeInteger(storeId) && storeId > 0) {
        const page = path.startsWith("/m/") ? "meeting" : path.startsWith("/e/") ? "exhibition" : "store";
        track("store_contact", { storeId, props: { kind: contact, page } });
        return;
      }

      if (path.startsWith("/m/")) return;
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
