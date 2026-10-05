import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { hasAladinKey } from "@/lib/books";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { HeaderAccount } from "@/components/HeaderAccount";
import { INSTAGRAM_HANDLE } from "@/lib/operator";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

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
        {/* 글씨는 12px(l2)·본문 회색(ink-2): 작은 글씨라 ink-3 는 sub 바탕에서 대비가 4.5:1 에 못 미친다 */}
        <footer className="border-t border-border bg-sub py-6 text-l2 font-normal leading-normal text-ink-2">
          <div className="mx-auto flex max-w-xl flex-col gap-4 px-4">
            <p>
              부엉이들의 서재는 동네책방 독서모임을 한곳에 모아 보여드리고 있습니다. 신청과 결제는 각 책방의 링크로 연결됩니다.
              일정과 내용은 책방 사정에 따라 바뀔 수 있으니 신청 전에 책방 안내를 꼭 확인해 주세요.
            </p>
            {hasAladinKey() && (
              <p>
                도서 DB 제공 :{" "}
                <a href="https://www.aladin.co.kr" target="_blank" rel="noopener noreferrer" className="underline">
                  알라딘 인터넷서점(www.aladin.co.kr)
                </a>
              </p>
            )}
            {/* 연락 방법은 왼쪽, 약관은 오른쪽. 한 줄에 다 안 들어가는 좁은 화면에서만 두 줄로 나뉜다 */}
            <div className="-my-2 flex flex-wrap items-center justify-between gap-x-6">
              {/* 글자색은 꿀빛 갈색(amber-active): 주변 회색·검정 글자와 구별되게 */}
              <nav aria-label="연락하기" className="flex gap-x-3 font-semibold text-amber-active">
                <Link href="/contact" className="inline-flex min-h-11 items-center underline">
                  의견 보내기
                </Link>
                {INSTAGRAM_HANDLE && (
                  <a
                    href={`https://www.instagram.com/${INSTAGRAM_HANDLE}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`인스타그램 @${INSTAGRAM_HANDLE}`}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    인스타그램
                  </a>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    aria-label={`이메일 ${contactEmail}`}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    이메일
                  </a>
                )}
              </nav>
              {/* 개인정보처리방침은 지침상 다른 고지와 구별되게 굵게 */}
              <nav aria-label="약관과 정책" className="flex gap-x-3">
                <Link href="/privacy" className="inline-flex min-h-11 items-center font-bold text-ink underline">
                  개인정보처리방침
                </Link>
                <Link href="/terms" className="inline-flex min-h-11 items-center underline">이용약관</Link>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
