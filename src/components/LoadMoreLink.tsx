"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

// '더 보기'를 눌러서 새 모임이 붙었을 때만 화면을 올려 준다(주소로 바로 들어오거나 뒤로 왔을 때는 그대로)
let clicked = false;
let restoreTimer: number | undefined;

// 브라우저는 내용이 끼어들면 보던 것(맨 끝에서는 바닥글)을 제자리에 두려고 화면을 순식간에 옮긴다(스크롤 고정).
// 마지막 '더 보기'처럼 바닥글 바로 위에 모임이 붙으면 그 때문에 화면이 맨 아래로 뚝 떨어지고, 더 올릴 자리가 없어 부드럽게 움직일 수 없다.
// 그래서 누른 순간부터 화면을 다 올릴 때까지만 이 고정을 끈다(새 모임이 안 와도 잠시 뒤 되돌린다)
function holdAnchoring(off: boolean, restoreAfter?: number) {
  window.clearTimeout(restoreTimer);
  document.documentElement.style.overflowAnchor = off ? "none" : "";
  if (off && restoreAfter) restoreTimer = window.setTimeout(() => holdAnchoring(false), restoreAfter);
}

// 목록 아래 '더 보기' 버튼. 주소에 몇 번째까지 펼쳤는지 남겨서, 뒤로 와도 보던 데까지 그대로 보인다.
// 누른 뒤 화면이 맨 위로 튀지 않게 제자리에 둔다(scroll={false}). 새 모임이 오면 RevealScroll이 화면을 부드럽게 올린다
export function LoadMoreLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        clicked = true;
        holdAnchoring(true, 8000);
      }}
      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-sm border border-border-card bg-page px-4 text-l1 font-medium text-ink hover:bg-sub active:bg-fill"
    >
      <Label />
    </Link>
  );
}

// 불러오는 동안 글자를 옅게 바꿔 눌린 걸 알려 준다
function Label() {
  const { pending } = useLinkStatus();
  return <span className={`transition-colors ${pending ? "text-ink-3" : ""}`}>{pending ? "불러오는 중…" : "더 보기"}</span>;
}

// 새로 붙은 모임 묶음 안에 넣는다. 나타나면 그 묶음 맨 위가 머리글 바로 아래 오도록 화면을 부드럽게 밀어 올린다.
// 마지막 묶음처럼 짧아서 거기까지 못 올라가면 페이지 끝까지만 부드럽게 올린다
export function RevealScroll() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!clicked) return;
    clicked = false;
    const target = ref.current?.parentElement;
    if (!target) return holdAnchoring(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // 부드럽게 올라가는 동안(0.5초 안팎)은 고정을 꺼 둔 채로 두었다가 되돌린다
    holdAnchoring(true, 1000);
  }, []);
  return <span ref={ref} hidden />;
}
