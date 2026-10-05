import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getProfile } from "@/lib/me";
import { withdraw } from "@/lib/me-actions";
import { PROVIDERS, isProviderId } from "@/lib/oauth";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";

export const metadata: Metadata = { title: "회원 탈퇴", robots: { index: false } };

// 탈퇴는 내 정보 화면 맨 아래 작은 링크로만 들어오는 따로 된 화면이다
export default async function WithdrawPage({ searchParams }: PageProps<"/me/account/withdraw">) {
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me/account/withdraw");
  const profile = await getProfile(user.id).catch(() => null);
  if (!profile) redirect("/me");
  const sp = await searchParams;
  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;

  return (
    <div className="pt-2">
      <Link href="/me/account" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        내 정보
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">회원 탈퇴</h1>
      <p className="mt-2 text-b2 text-ink-2">탈퇴하기 전에 아래 내용을 확인해 주세요.</p>

      <ul className="mt-5 space-y-2 rounded-md border border-border-card bg-sub p-4 text-b2 text-ink-2 [&_li]:ml-4 [&_li]:list-disc">
        <li>로그인 정보와 찜한 모임·책방, 남긴 기록이 모두 바로 지워지고 되살릴 수 없어요.</li>
        <li>{providerLabel} 계정 자체는 그대로예요. 다시 로그인하면 새 회원으로 시작해요.</li>
      </ul>

      <Link
        href="/me"
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-sm bg-navy py-3 text-t2 text-white hover:bg-navy-hover active:bg-navy-active"
      >
        계속 이용하기
      </Link>

      <form action={withdraw} className="mt-10 border-t border-border pt-5">
        {sp.error === "confirm" && (
          <p role="alert" className="mb-3 rounded-xs border border-error-border bg-error-surface px-3 py-2 text-b2 text-error">
            아래 확인 칸을 체크해 주세요.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-2 text-b2 text-ink">
          <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5 accent-[var(--color-navy)]" />
          찜과 기록이 모두 지워지는 것을 확인했어요
        </label>
        <SubmitButton
          confirm="정말 탈퇴할까요? 찜과 기록이 모두 지워지고 되살릴 수 없어요."
          pendingText="탈퇴하는 중…"
          className="mt-2 min-h-11 w-full rounded-sm border border-error-border bg-card py-2.5 text-l1 font-semibold text-error hover:bg-error-surface"
        >
          탈퇴하기
        </SubmitButton>
      </form>
    </div>
  );
}
