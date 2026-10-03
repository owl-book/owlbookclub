import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/auth-shared";
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

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getCurrentUser()) redirect(next);

  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const providers = isAuthEnabled() ? PROVIDER_ORDER.filter(isProviderReady) : [];
  const inApp = inAppBrowser((await headers()).get("user-agent") ?? "");

  return (
    <div className="pt-10">
      <h1 className="font-display text-h2 text-ink">
        <span aria-hidden>🦉</span> 부엉이서재 로그인
      </h1>
      <p className="mt-2 text-b2 text-ink-2">
        {sp.reason === "wish"
          ? "로그인하면 방금 누른 찜이 바로 저장돼요."
          : sp.reason === "plan"
          ? "로그인하면 방금 신청한 모임이 내 모임에 바로 담겨요."
          : "로그인하면 모임·책방을 찜하고, 신청한 모임 일정과 다녀온 모임 기록을 나만 보는 곳에 모아 둘 수 있어요."}
        <br />
        모임 둘러보기는 로그인 없이도 돼요.
      </p>

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
        <ul className="mt-6 flex flex-col gap-2.5">
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
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-sm px-4 text-t2 hover:brightness-95 active:brightness-90 ${b.className}`}
                >
                  {b.icon}
                  {b.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-l2 font-normal leading-normal text-ink-3">
        로그인하면 부엉이서재{" "}
        <Link href="/terms" className="underline">이용약관</Link>과{" "}
        <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하게 됩니다. 로그인한 서비스에서 받는 정보는 회원 고유번호와 별명뿐이에요.
      </p>
    </div>
  );
}
