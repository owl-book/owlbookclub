"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasVisitedList } from "@/lib/nav-memory";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";

// 목록에서 들어왔으면 '뒤로 가기'로 돌아가 고른 날짜·검색어와 스크롤 위치를 지킨다.
// 공유 링크로 바로 들어온 경우(이전 페이지가 우리 사이트가 아님)에는 첫 화면으로 보낸다.
// label: 책방 화면처럼 모임 상세 등 여러 곳에서 들어오는 화면은 '뒤로'로 쓴다
export function BackLink({ label = "모임 목록" }: { label?: string }) {
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
      className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy"
    >
      <ArrowLeftIcon />
      {label}
    </Link>
  );
}
