import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { hasAladinKey } from "@/lib/books";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { HeaderAccount } from "@/components/HeaderAccount";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "부엉이들의 서재 · 동네책방에서 열리는 독서모임 모아보기", template: "%s · 부엉이들의 서재" },
  description: "흩어진 동네책방 독서모임을 날짜별로 모아 보고, 책방 신청 페이지로 바로 연결합니다.",
  openGraph: {
    title: "부엉이들의 서재 · 동네책방에서 열리는 독서모임 모아보기",
    description: "흩어진 동네책방 독서모임을 날짜별로 모아 보고, 책방 신청 페이지로 바로 연결합니다.",
    siteName: "부엉이들의 서재",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff", // 디자인 시스템 v2.2: 페이지 전체 다크모드 없음
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 로그인 키가 아직 없으면 헤더에 로그인 버튼을 보이지 않는다
  const authEnabled = isAuthEnabled();
  const user = authEnabled ? await getCurrentUser() : null;
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-navy bg-navy">
          {/* 높이 h-14 고정: 목록의 날짜 제목이 이 아래(top-14)에 붙는다 */}
          <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
            <Link href="/" className="flex min-h-11 items-center gap-1.5 font-display text-t1 text-page focus-visible:outline-page">
              <span aria-hidden>🦉</span> 부엉이들의 서재
            </Link>
            {authEnabled && <HeaderAccount user={user} />}
          </div>
          <Suspense>
            <NavProgress />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16">{children}</main>
        <footer className="border-t border-border bg-sub py-6 text-l2 font-normal leading-normal text-ink-3">
          <div className="mx-auto flex max-w-xl flex-col gap-2 px-4">
            <p>이곳은 모임 소식을 모아 둔 게시판이에요. 신청과 결제는 각 책방에서 해 주세요.</p>
            <p>
              게재 삭제·수정을 원하시는 책방은{" "}
              {process.env.NEXT_PUBLIC_INSTAGRAM_URL ? (
                <a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL} className="underline">인스타그램 &lsquo;부엉이들의 서재&rsquo;</a>
              ) : (
                "인스타그램 ‘부엉이들의 서재’"
              )}{" "}
              DM으로 알려주시면 바로 반영하겠습니다.
            </p>
            {hasAladinKey() && (
              <p>
                도서 DB 제공 :{" "}
                <a href="https://www.aladin.co.kr" target="_blank" rel="noopener noreferrer" className="underline">
                  알라딘 인터넷서점(www.aladin.co.kr)
                </a>
              </p>
            )}
            <div className="flex gap-3">
              <Link href="/privacy" className="underline">개인정보처리방침</Link>
              <Link href="/terms" className="underline">이용약관</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
