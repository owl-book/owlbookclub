"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasVisitedList } from "@/lib/nav-memory";

// 목록에서 들어왔으면 '뒤로 가기'로 돌아가 고른 날짜·검색어와 스크롤 위치를 지킨다.
// 공유 링크로 바로 들어온 경우(이전 페이지가 우리 사이트가 아님)에는 첫 화면으로 보낸다.
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (hasVisitedList()) {
          e.preventDefault();
          router.back();
        }
      }}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-l1 text-ink-2 hover:text-navy"
    >
      ← 모임 목록
    </Link>
  );
}
