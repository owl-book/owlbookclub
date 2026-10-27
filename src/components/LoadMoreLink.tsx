"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

// '더 보기'를 눌러서 새 모임이 붙었을 때만 화면을 올려 준다(주소로 바로 들어오거나 뒤로 왔을 때는 그대로)
let clicked = false;

// 목록 아래 '더 보기' 버튼. 주소에 몇 번째까지 펼쳤는지 남겨서, 뒤로 와도 보던 데까지 그대로 보인다.
// 누른 뒤 화면이 맨 위로 튀지 않게 제자리에 둔다(scroll={false}). 새 모임이 오면 RevealScroll이 화면을 부드럽게 올린다
export function LoadMoreLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        clicked = true;
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

// 새로 붙은 모임 묶음 안에 넣는다. 나타나면 그 묶음 맨 위가 머리글 바로 아래 오도록 화면을 부드럽게 밀어 올린다
export function RevealScroll() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!clicked) return;
    clicked = false;
    const target = ref.current?.parentElement;
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);
  return <span ref={ref} hidden />;
}
