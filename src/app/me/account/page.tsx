import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { getLiveUser, isAuthEnabled } from "@/lib/auth";
import { getProfile } from "@/lib/me";
import { signOutOtherDevices, updateDisplayName } from "@/lib/me-actions";
import { Toast } from "@/components/Toast";
import { PROVIDERS, isProviderId } from "@/lib/oauth";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";

export const metadata: Metadata = { title: "내 정보", robots: { index: false } };

// '다른 기기 모두 로그아웃' 결과 안내
const OTHERS_MESSAGE: Record<string, { message: string; tone: "success" | "error" }> = {
  done: { message: "다른 기기에서 모두 로그아웃했어요", tone: "success" },
  retry: { message: "처리하지 못했어요. 다시 눌러 주세요", tone: "error" },
  unavailable: { message: "지금은 이 기능을 쓸 수 없어요", tone: "error" },
};

export default async function AccountPage({ searchParams }: PageProps<"/me/account">) {
  // 로그인 키 유무는 배포 환경에서 판단해야 하므로, 조립할 때 미리 만들어 두지 않고 방문할 때마다 그린다
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getLiveUser("/me/account");
  if (!user) redirect("/login?next=/me/account");
  // 회원 정보가 없거나 저장 공간이 아직 없으면 마이페이지가 안내한다
  const profile = await getProfile(user.id).catch(() => null);
  if (!profile) redirect("/me");
  const sp = await searchParams;
  const others = typeof sp.others === "string" ? OTHERS_MESSAGE[sp.others] : undefined;
  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;

  return (
    <div className="pt-2">
      <Link href="/me" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        마이페이지
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
          <SubmitButton pendingText="저장하는 중…" className="mt-3 min-h-12 w-full rounded-sm bg-navy py-3 text-t2 text-page hover:bg-navy-hover active:bg-navy-active">
            저장
          </SubmitButton>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-t2 text-ink">로그인 계정</h2>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-b2 text-ink-2">{providerLabel} 계정으로 로그인했어요</p>
          <form action="/auth/logout" method="post">
            <button type="submit" className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-border px-4 text-l1 text-ink-2 hover:bg-sub">
              로그아웃
            </button>
          </form>
        </div>
        {/* 휴대폰을 잃어버렸거나 공용 PC에서 로그아웃을 잊었을 때. 지금 이 기기는 그대로 로그인돼 있다 */}
        <form action={signOutOtherDevices} className="mt-4 rounded-sm bg-sub px-4 py-3.5">
          <p className="text-b2 text-ink">다른 기기에서 모두 로그아웃</p>
          <p className="mt-1 text-l2 font-normal leading-normal text-ink-3">
            휴대폰을 잃어버렸거나 다른 컴퓨터에서 로그아웃을 잊었을 때 눌러 주세요. 지금 쓰는 이 기기는 로그인이 유지돼요.
          </p>
          <SubmitButton pendingText="로그아웃하는 중…" className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-border bg-card px-4 text-l1 text-ink-2 hover:bg-page">
            다른 기기 모두 로그아웃
          </SubmitButton>
        </form>
        {/* 탈퇴는 자주 쓰는 기능이 아니라서 계정 칸 맨 끝에 작고 흐린 글씨로만 둔다(로그아웃과는 좌우·위아래로 떨어뜨림) */}
        <div className="mt-4 border-t border-border pt-2">
          <Link href="/me/account/withdraw" className="-ml-1 inline-flex min-h-11 items-center px-1 text-l2 font-normal text-ink-3 underline hover:text-ink-2">
            회원 탈퇴
          </Link>
        </div>
      </section>
      {others && <Toast message={others.message} tone={others.tone} clearParam="others" />}
    </div>
  );
}
