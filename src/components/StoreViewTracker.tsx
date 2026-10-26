"use client";

import { useEffect, useRef } from "react";
import { getPathBefore } from "@/lib/nav-memory";
import { track } from "@/lib/track-client";

// 책방 상세 화면이 사람 브라우저에서 실제로 열리면 1건(store_view). 링크 미리 불러오기·미리보기 봇은 세지 않으려고 서버가 아니라 여기서 센다.
// from: 사이트 안에서 왔으면 직전 화면 종류, 처음 열었으면 바깥 링크(external)인지 주소 직접 입력·즐겨찾기(direct)인지
export function StoreViewTracker({ storeId }: { storeId: number }) {
  const sent = useRef<number | null>(null);

  useEffect(() => {
    if (sent.current === storeId) return; // 개발 모드에서 효과가 두 번 도는 것 막기
    sent.current = storeId;
    track("store_view", { storeId, props: { from: fromOf(getPathBefore(location.pathname)) } });
  }, [storeId]);

  return null;
}

function fromOf(prev: string): string {
  if (!prev) {
    try {
      return document.referrer && new URL(document.referrer).origin !== location.origin ? "external" : "direct";
    } catch {
      return "direct";
    }
  }
  if (prev === "/") return "home";
  if (prev === "/stores") return "stores";
  if (prev.startsWith("/m/")) return "meeting";
  if (prev === "/exhibitions" || prev.startsWith("/e/")) return "exhibition";
  if (prev.startsWith("/me")) return "me";
  if (prev.startsWith("/s/")) return "store";
  return "other";
}
