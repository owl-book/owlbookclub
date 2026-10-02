"use client";

import { useState } from "react";
import { track } from "@/lib/track-client";

// 공유 링크에는 전용 UTM(utm_source=share)을 붙여 지인 공유 유입을 구분한다
export function ShareButton({ meetingId, storeId, title }: { meetingId: number; storeId: number; title: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  const share = async () => {
    const url = `${location.origin}/m/${meetingId}?utm_source=share&utm_medium=button&utm_content=${meetingId}`;
    const text = `${title} — 부엉이서재에서 찾은 독서모임`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        track("share", { meetingId, storeId, props: { method: "native" } });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // 사용자가 취소
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg("링크를 복사했어요");
    } catch {
      window.prompt("아래 링크를 복사해 공유해주세요", url);
    }
    track("share", { meetingId, storeId, props: { method: "copy" } });
    setTimeout(() => setMsg(null), 2000);
  };

  return (
    <button onClick={share} className="min-h-11 flex-1 rounded-sm border border-border-strong bg-card py-3 text-l1 font-semibold text-navy hover:bg-sub">
      {msg ?? "공유하기"}
    </button>
  );
}
