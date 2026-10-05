"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth-shared";

// 헤더 오른쪽: 로그인 전엔 '로그인', 로그인 후엔 마이페이지 아이콘(로그아웃은 마이페이지 안에)
export function HeaderAccount({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  if (!user) {
    if (pathname === "/login") return null;
    return (
      <a
        href={`/login?next=${encodeURIComponent(pathname)}`}
        // 누르는 순간의 검색어·날짜 조건까지 그대로 돌아오도록
        onClick={(e) => {
          e.currentTarget.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }}
        className="inline-flex min-h-11 items-center px-1 text-l1 text-page/80 hover:text-page focus-visible:outline-page"
      >
        로그인
      </a>
    );
  }

  const active = pathname.startsWith("/me");
  return (
    <Link
      href="/me"
      aria-label={`마이페이지 (${user.name}님)`}
      aria-current={active ? "page" : undefined}
      className={`-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-navy-hover focus-visible:outline-page ${active ? "text-page" : "text-page/80"}`}
    >
      {/* 마이페이지 안에선 머리·몸 모두 채운다 */}
      <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${active ? "fill-current" : "fill-none"}`} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20.25c0-3.6 3.35-6 7.5-6s7.5 2.4 7.5 6z" />
      </svg>
    </Link>
  );
}
