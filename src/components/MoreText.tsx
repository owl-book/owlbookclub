"use client";

import { useId, useState, type ReactNode } from "react";

// 긴 글은 처음에 몇 줄만 보여 주고 '더 보기'로 펼친다 → 신청 버튼이 너무 아래로 밀리지 않게.
// 길이 판단은 서버에서 해서 넘긴다(화면이 그려진 뒤 높이를 재면 글이 한 번 출렁인다).
export function MoreText({ long, children }: { long: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!long) return children;

  return (
    <div>
      <div id={id} className={open ? "" : "relative max-h-44 overflow-hidden"}>
        {children}
        {!open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-page to-transparent" />}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 text-l1 font-semibold text-navy hover:text-navy-hover"
      >
        {open ? "접기" : "더 보기"}
      </button>
    </div>
  );
}
