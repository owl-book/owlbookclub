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
      window.prompt("아래 링크를 복사해 공유해 주세요", url);
    }
    track("share", { meetingId, storeId, props: { method: "copy" } });
    setTimeout(() => setMsg(null), 2000);
  };

  // 보이는 알약은 작게, 누르는 영역은 바깥 버튼(높이 44px)으로 넉넉하게
  return (
    <button type="button" onClick={share} aria-label={msg ? undefined : "이 모임 공유하기"} className="group -mr-1 inline-flex min-h-11 shrink-0 items-center px-1">
      <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-card py-1.5 pr-3 pl-2.5 text-l1 text-navy group-hover:bg-sub group-active:bg-fill">
        <ShareIcon />
        <span aria-live="polite">{msg ?? "공유"}</span>
      </span>
    </button>
  );
}

// 네모에서 위로 나가는 화살표(공유). 아이콘 규격: 24 격자, 선 1.75
function ShareIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 11H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
