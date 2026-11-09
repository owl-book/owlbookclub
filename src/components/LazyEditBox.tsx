"use client";

import { useState, type ReactNode } from "react";

// 승인 화면의 '고치기' 접이식 칸. 펼칠 때 처음으로 폼을 화면에 만든다.
// 카드마다 입력칸 수십 개를 미리 만들어 두지 않아 화면이 빨리 뜨고 가볍다.
// (접어 둔 칸에는 고친 내용이 없으므로 [승인] 때 저장할 것도 없다)
export function LazyEditBox({ label, children }: { label: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="group mt-2 rounded-sm border border-border bg-card"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-l1 font-semibold text-navy [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-3 pt-3 pb-3">{opened ? children : null}</div>
    </details>
  );
}
