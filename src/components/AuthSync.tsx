"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 같은 브라우저의 다른 탭끼리 로그인 상태를 맞춘다.
// 화면을 열 때마다 "지금 이 브라우저의 로그인 상태는 이 회원(또는 비로그인)"이라고 다른 탭에 알리고,
// 알림을 받은 탭은 자기가 그린 상태와 다르면 서버 화면을 다시 읽는다.
// - 한 탭에서 로그아웃하면 → 그 탭이 홈을 다시 열며 '비로그인'을 알림 → 다른 탭의 회원 표시가 바로 사라진다
// - 한 탭에서 로그인·다른 계정으로 바꿔도 같은 방식으로 맞춰진다
// 쿠키는 탭끼리 같으니, 새로 연 화면이 알리는 상태가 언제나 지금의 진짜 상태다.
// (오래 떠나 있다 돌아올 때 다시 읽는 일은 RefreshOnReturn 이 따로 한다)
const CHANNEL = "owl-auth";

export function AuthSync({ userId }: { userId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<{ userId: string | null }>) => {
      if ((e.data?.userId ?? null) !== userId) router.refresh();
    };
    channel.postMessage({ userId });
    return () => channel.close();
  }, [userId, router]);

  return null;
}
