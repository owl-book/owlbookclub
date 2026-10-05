import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { AUTH_COOKIE, safeNext } from "@/lib/auth-shared";
import { PROVIDER_ORDER, isProviderReady, type ProviderId } from "@/lib/oauth";
import { OpenExternalBrowser } from "@/components/OpenExternalBrowser";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

const ERRORS: Record<string, string> = {
  cancelled: "로그인을 취소했어요.",
  expired: "로그인 시간이 지났어요. 다시 시도해 주세요.",
  failed: "로그인 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
  unavailable: "지금은 이 로그인 방법을 쓸 수 없어요.",
};

// 인스타그램·카카오톡·페이스북 등 앱 안의 브라우저. 구글은 이런 곳에서의 로그인을 막는다.
function inAppBrowser(ua: string): "kakaotalk" | "other" | null {
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk";
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|Threads|Barcelona/i.test(ua)) return "other";
  return null;
}

const BUTTON: Record<ProviderId, { label: string; className: string; icon: React.ReactNode }> = {
  kakao: {
    label: "카카오로 시작하기",
    className: "bg-[#FEE500] text-black/85",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="size-5">
        <path fill="currentColor" d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-.9 3.4c-.1.3.3.6.6.4l4-2.6h1.1c5 0 9-3.1 9-7s-4-7.1-9-7.1Z" />
      </svg>
    ),
  },
  naver: {
    label: "네이버로 시작하기",
    className: "bg-[#03C75A] text-white",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
        <path fill="currentColor" d="M16.3 12.8 7.4 0H0v24h7.7V11.2L16.6 24H24V0h-7.7z" />
      </svg>
    ),
  },
  google: {
    label: "구글로 시작하기",
    className: "border border-border-control bg-white text-ink",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="size-5">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.6V6.7h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
      </svg>
    ),
  },
};

// '로그인 없이 둘러보기'로 돌아갈 화면. 찜·신청 저장 주소(/wish, /plan)로 보내면 다시 로그인 화면으로 오므로 그 주소가 돌아갈 곳으로 간다
function browseHref(next: string): string {
  const url = new URL(next, "http://owl.local");
  return url.pathname === "/wish" || url.pathname === "/plan" ? safeNext(url.searchParams.get("next")) : next;
}

const BENEFITS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "모임·책방 찜하기",
    icon: <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />,
  },
  {
    label: "신청한 일정 모아 보기",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    label: "다녀온 모임 기록하기",
    icon: <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v14c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-14c-3.8 0-6.3.5-8 2Zm0 0v14" />,
  },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getCurrentUser()) redirect(next);

  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const providers = isAuthEnabled() ? PROVIDER_ORDER.filter(isProviderReady) : [];
  const inApp = inAppBrowser((await headers()).get("user-agent") ?? "");
  // 이 기기에서 지난번에 쓴 로그인 방법. 버튼 순서는 그대로 두고 말풍선만 붙인다
  const lastProvider = (await cookies()).get(AUTH_COOKIE.lastProvider)?.value;

  return (
    <div className="pt-10">
      <h1 className="font-display text-h2 text-balance break-keep text-ink">가고 싶은 모임, 놓치지 않게</h1>
      <p className="mt-2 text-b2 text-ink-2">로그인하고 다양한 혜택을 받아보세요.</p>

      {/* 가입하면 할 수 있는 일. 가입 직후 환영 화면에서는 다시 설명하지 않는다 */}
      <ul className="mt-5 grid grid-cols-3 divide-x divide-border">
        {BENEFITS.map((b) => (
          <li key={b.label} className="flex flex-col items-center gap-1.5 px-1.5 text-center">
            <svg viewBox="0 0 24 24" aria-hidden className="size-6 text-navy" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              {b.icon}
            </svg>
            {/* 좁은 화면에서는 띄어쓰기 자리에서만 줄을 바꾼다('모임·책방'이 가운뎃점에서 끊기지 않게 낱말마다 묶는다) */}
            <span className="text-balance text-l1 leading-snug text-ink">
              {b.label.split(" ").map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span className="whitespace-nowrap">{word}</span>
                </Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-5 rounded-xs border border-error-border bg-error-surface px-3 py-2.5 text-b2 text-error">
          {error}
        </p>
      )}

      {providers.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
          <p className="text-t2 text-ink">로그인은 준비 중이에요</p>
          <p className="mt-1 text-b2 text-ink-2">조금만 기다려 주세요.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {providers.map((id) => {
            const b = BUTTON[id];
            if (id === "google" && inApp) {
              return (
                <li key={id} className="rounded-sm border border-border bg-sub px-4 py-3">
                  <p className="text-l1 text-ink">구글 로그인은 이 앱 안에서 열리지 않아요</p>
                  <p className="mt-1 text-l2 font-normal leading-normal text-ink-3">
                    구글 정책상 인스타그램·카카오톡 같은 앱 안의 화면에서는 구글 로그인이 막혀 있어요. 카카오·네이버로 로그인하거나, 사파리·크롬에서 열어 주세요.
                  </p>
                  <OpenExternalBrowser kakaotalk={inApp === "kakaotalk"} />
                </li>
              );
            }
            return (
              <li key={id}>
                {/* 각 회사 로그인 화면으로 이동하는 전체 이동이라 <a> 를 쓴다 */}
                <a
                  href={`/auth/${id}?next=${encodeURIComponent(next)}`}
                  className={`relative flex min-h-12 items-center justify-center gap-2 rounded-sm px-4 text-t2 hover:brightness-95 active:brightness-90 ${b.className}`}
                >
                  {b.icon}
                  {b.label}
                  {id === lastProvider && (
                    <span className="pointer-events-none absolute -top-2.5 right-3 rounded-full bg-navy px-2 py-0.5 text-l2 leading-tight text-white">
                      최근 사용
                      <span aria-hidden className="absolute -bottom-1 right-3 size-2 rotate-45 bg-navy" />
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <Link href={browseHref(next)} className="mt-2 flex min-h-11 items-center justify-center text-l1 text-ink-2 underline underline-offset-4 hover:text-navy">
        로그인 없이 둘러보기
      </Link>

      <p className="mt-4 text-l2 font-normal leading-normal text-ink-3">
        로그인하면 부엉이들의 서재{" "}
        <Link href="/terms" className="underline">이용약관</Link>과{" "}
        <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하게 됩니다. 만 14세 이상만 가입할 수 있어요. 로그인한 서비스에서 받는 정보는 회원 고유번호와 별명뿐이에요.
      </p>
    </div>
  );
}
