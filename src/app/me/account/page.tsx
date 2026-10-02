import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getProfile } from "@/lib/me";
import { updateDisplayName, withdraw } from "@/lib/me-actions";
import { PROVIDERS, isProviderId } from "@/lib/oauth";

export const metadata: Metadata = { title: "내 정보", robots: { index: false } };

export default async function AccountPage({ searchParams }: PageProps<"/me/account">) {
  // 로그인 키 유무는 배포 환경에서 판단해야 하므로, 조립할 때 미리 만들어 두지 않고 방문할 때마다 그린다
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me/account");
  // 회원 정보가 없거나 저장 공간이 아직 없으면 마이페이지가 안내한다
  const profile = await getProfile(user.id).catch(() => null);
  if (!profile) redirect("/me");
  const sp = await searchParams;
  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;

  return (
    <div className="pt-2">
      <Link href="/me" className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-l1 text-ink-2 hover:text-navy">
        ← 마이페이지
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">내 정보</h1>

      <section className="mt-6">
        <h2 className="text-t2 text-ink">별명 바꾸기</h2>
        <form action={updateDisplayName} className="mt-3">
          <label htmlFor="displayName" className="sr-only">
            별명
          </label>
          <input
            id="displayName"
            name="displayName"
            maxLength={20}
            defaultValue={profile.displayName ?? profile.nickname ?? ""}
            placeholder={profile.nickname ?? "별명"}
            className="w-full rounded-xs border border-border-control bg-card px-3 py-2.5 text-b1 text-ink"
          />
          <p className="mt-1.5 text-l2 font-normal leading-normal text-ink-3">
            20자까지. 비워 두고 저장하면 {providerLabel} 별명({profile.nickname ?? "없음"})을 써요. 별명은 나에게만 보여요.
          </p>
          <button type="submit" className="mt-3 min-h-12 w-full rounded-sm bg-navy py-3 text-t2 text-white hover:bg-navy-hover active:bg-navy-active">
            저장
          </button>
        </form>
      </section>

      <section id="withdraw" className="mt-12 rounded-md border border-border-card bg-sub p-4">
        <h2 className="text-t2 text-ink">회원 탈퇴</h2>
        <ul className="mt-2 space-y-1 text-b2 text-ink-2 [&_li]:ml-4 [&_li]:list-disc">
          <li>로그인 정보와 찜한 모임·책방, 남긴 기록이 모두 바로 지워지고 되살릴 수 없어요.</li>
          <li>{providerLabel} 계정 자체는 그대로예요. 다시 로그인하면 새 회원으로 시작해요.</li>
        </ul>
        {sp.error === "confirm" && (
          <p role="alert" className="mt-3 rounded-xs border border-error-border bg-error-surface px-3 py-2 text-b2 text-error">
            아래 확인 칸을 체크해 주세요.
          </p>
        )}
        <form action={withdraw} className="mt-3">
          <label className="flex min-h-11 items-center gap-2 text-b2 text-ink">
            <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5 accent-[var(--color-navy)]" />
            찜과 기록이 모두 지워지는 것을 확인했어요
          </label>
          <ConfirmSubmit
            message="정말 탈퇴할까요? 찜과 기록이 모두 지워지고 되살릴 수 없어요."
            className="mt-2 min-h-11 w-full rounded-sm border border-error-border bg-card py-2.5 text-l1 font-semibold text-error hover:bg-error-surface"
          >
            탈퇴하기
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
