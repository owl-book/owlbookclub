"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { gaEvent } from "@/lib/ga";

// 구글 애널리틱스(GA4): 방문·머문 시간·화면 이동은 GA 가 알아서 센다.
// 모임·책방·신청 버튼 클릭은 각 부품을 고치지 않고, 화면 전체에서 링크 주소로 알아본다.
//   /m/{id}  → meeting_click (모임 열어 보기)
//   /s/{id}  → store_click   (책방 열어 보기)
//   /go/{id} → apply_click   (책방에서 신청하기·원 게시물 보기, target 으로 구분)
// 관리자 화면에서 처음 연 경우에는 불러오지 않는다(운영자 기기는 layout 에서 이미 뺀다).
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const skip = pathname.startsWith("/admin");

  useEffect(() => {
    if (skip) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const match = url.pathname.match(/^\/(m|s|go)\/(\d+)$/);
      if (!match) return;
      const [, kind, id] = match;
      const label = (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 100);
      const base = { link_text: label, from_page: location.pathname };
      if (kind === "m") gaEvent("meeting_click", { ...base, meeting_id: id });
      else if (kind === "s") gaEvent("store_click", { ...base, store_id: id });
      else gaEvent("apply_click", { ...base, meeting_id: id, target: url.searchParams.get("to") === "post" ? "post" : "apply" });
    };
    // capture: 신청 버튼처럼 기본 동작을 막는 링크도 빠짐없이 센다
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [skip]);

  if (skip) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
