"use client";

import { useEffect } from "react";
import { isInstalled } from "@/lib/app-mode";

// 홈 화면에 설치한 앱에서는 로그인이 풀리지 않게: 앱을 열거나 다시 앞으로 가져올 때 로그인 기간을 늘려 달라고 서버에 알린다.
// 서버가 하루에 한 번만 실제로 늘린다. 일반 브라우저에서는 아무것도 하지 않는다(기존처럼 로그인 후 60일).
export function KeepAppLogin() {
  useEffect(() => {
    if (!isInstalled()) return;
    const refresh = () => {
      fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
    };
    refresh();
    // 아이폰 앱은 닫지 않고 며칠 뒤 다시 꺼내 쓰는 경우가 많아, 화면이 다시 보일 때도 알린다
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
