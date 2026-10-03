"use client";

import { useState, useTransition } from "react";
import { setWish } from "@/lib/me-actions";

type Props = {
  kind: "meeting" | "store";
  id: number;
  wished: boolean;
  loggedIn: boolean;
  label: string; // 화면 읽기 프로그램용: 모임 제목 또는 책방 이름
  size?: "md" | "sm" | "bar"; // bar: 상세화면 아래 고정 띠에서 신청 버튼 옆에 놓는 네모 버튼
};

const SHAPES = {
  md: "size-11 rounded-full hover:bg-sub",
  // 보이는 원은 36px, 누르는 영역은 투명한 가장자리를 더해 44px
  sm: "size-9 rounded-full hover:bg-sub before:absolute before:-inset-1 before:content-['']",
  bar: "size-12 rounded-sm border border-border-card bg-card hover:bg-sub",
};

// 찜 하트. 로그인 전에는 /wish 링크(로그인 → 찜 완료 → 원래 화면), 로그인 후에는 누르는 즉시 바뀌고 서버에 저장한다.
export function WishButton({ kind, id, wished, loggedIn, label, size = "md" }: Props) {
  const [on, setOn] = useState(wished);
  const [synced, setSynced] = useState(wished);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  // 다른 화면에서 바뀐 찜 상태가 새로 내려오면 따라간다
  if (wished !== synced) {
    setSynced(wished);
    setOn(wished);
  }

  const what = kind === "meeting" ? "모임" : "책방";
  const className = `relative z-10 inline-flex ${SHAPES[size]} shrink-0 items-center justify-center active:scale-95`;

  if (!loggedIn) {
    return (
      <a
        href={`/wish?t=${kind}&id=${id}&next=/`}
        // 누르는 순간의 주소(검색어·날짜 조건 포함)로 돌아오도록
        onClick={(e) => {
          e.stopPropagation();
          const next = window.location.pathname + window.location.search;
          e.currentTarget.href = `/wish?t=${kind}&id=${id}&next=${encodeURIComponent(next)}`;
        }}
        aria-label={`${label} ${what} 찜하기 (로그인 필요)`}
        className={className}
      >
        <Heart filled={false} />
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${label} ${what} 찜${on ? " 취소" : "하기"}`}
      title={failed ? "저장하지 못했어요. 다시 눌러 주세요." : undefined}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextOn = !on;
        setOn(nextOn);
        setFailed(false);
        startTransition(async () => {
          try {
            await setWish(kind, id, nextOn);
          } catch {
            setOn(!nextOn);
            setFailed(true);
          }
        });
      }}
      className={className}
    >
      <Heart filled={on} />
    </button>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`size-6 ${filled ? "fill-navy text-navy" : "fill-none text-ink-2"}`}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
    </svg>
  );
}
