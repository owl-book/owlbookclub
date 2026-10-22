"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth-shared";

// 헤더 오른쪽 사람 아이콘: 로그인 전엔 로그인 화면으로, 로그인 후엔 마이페이지로(로그아웃은 마이페이지 안에)
export function HeaderAccount({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  if (!user) {
    if (pathname === "/login") return null;
    return (
      <a
        href={`/login?next=${encodeURIComponent(pathname)}`}
        aria-label="로그인"
        // 누르는 순간의 검색어·날짜 조건까지 그대로 돌아오도록
        onClick={(e) => {
          e.currentTarget.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }}
        className={ICON_BUTTON + " text-page/80"}
      >
        <PersonIcon filled={false} />
      </a>
    );
  }

  const active = pathname.startsWith("/me");
  return (
    <Link
      href="/me"
      aria-label={`마이페이지 (${user.name}님)`}
      aria-current={active ? "page" : undefined}
      className={`${ICON_BUTTON} ${active ? "text-page" : "text-page/80"}`}
    >
      {/* 마이페이지 안에선 머리·몸 모두 채운다 */}
      <PersonIcon filled={active} />
    </Link>
  );
}

const ICON_BUTTON = "inline-flex size-11 items-center justify-center rounded-full hover:bg-navy-hover hover:text-page focus-visible:outline-page";

// 로그인 전·후 같은 사람 모양(로그인 전엔 눌러서 로그인, 로그인 후엔 마이페이지)
function PersonIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${filled ? "fill-current" : "fill-none"}`} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.25c0-3.6 3.35-6 7.5-6s7.5 2.4 7.5 6z" />
    </svg>
  );
}
