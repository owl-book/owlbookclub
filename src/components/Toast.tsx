"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  clearParam: string; // 새로고침해도 다시 뜨지 않도록 주소에서 지울 값 이름(예: "saved")
  focusId?: string; // 방금 바뀐 항목이 있으면 그 자리로 화면을 옮긴다
};

const SHOW_MS = 4000;

// 저장·삭제처럼 끝나면 다른 화면으로 넘어가는 동작 뒤에 화면 아래에 잠깐 떠서 결과를 알려 주는 알림.
// 4초 뒤 저절로 사라지고, 눌러서 바로 닫을 수도 있다. 화면 읽기 프로그램에도 읽힌다(role="status").
export function Toast({ message, clearParam, focusId }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(clearParam)) {
      url.searchParams.delete(clearParam);
      window.history.replaceState(window.history.state, "", url);
    }
    if (focusId) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(focusId)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    const t = window.setTimeout(() => setOpen(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [clearParam, focusId]);

  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div
        role="status"
        className="owl-toast pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-sm bg-ink py-1.5 pl-4 pr-1.5 text-b2 text-white shadow-lg"
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-success-dark">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
        <span className="flex-1">{message}</span>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xs text-white/70 hover:text-white">
          <span className="sr-only">알림 닫기</span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
