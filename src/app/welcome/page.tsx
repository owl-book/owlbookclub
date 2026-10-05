import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/auth-shared";
import { getProfile } from "@/lib/me";
import { updateDisplayName } from "@/lib/me-actions";
import { PROVIDERS, isProviderId } from "@/lib/oauth";

export const metadata: Metadata = { title: "환영해요", robots: { index: false } };

// 처음 가입한 회원이 로그인 직후 한 번 들르는 화면: 별명을 정하거나 건너뛰고 원래 보던 페이지로 간다
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await connection();
  if (!isAuthEnabled()) notFound();
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  // 회원 정보를 못 읽으면 별명은 나중에 마이페이지에서 정하도록 그냥 보낸다
  const profile = await getProfile(user.id).catch(() => null);
  if (!profile) redirect(next);
  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;

  return (
    <div className="pt-10">
      <h1 className="font-display text-h2 text-ink">
        <span aria-hidden>🦉</span> 반가워요!
      </h1>
      <p className="mt-2 text-b2 text-ink-2">
        부엉이들의 서재에서 쓸 별명을 정해 주세요.
        <br />
        나중에 마이페이지 &gt; 내 정보에서 언제든 바꿀 수 있어요.
      </p>

      <form action={updateDisplayName} className="mt-6">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="displayName" className="text-t2 text-ink">
          별명
        </label>
        <input
          id="displayName"
          name="displayName"
          maxLength={20}
          defaultValue={profile.displayName ?? profile.nickname ?? ""}
          placeholder={profile.nickname ?? "별명"}
          className="mt-2 w-full rounded-xs border border-border-control bg-card px-3 py-2.5 text-b1 text-ink"
        />
        <p className="mt-1.5 text-l2 font-normal leading-normal text-ink-3">
          20자까지. 비워 두면 {providerLabel} 별명({profile.nickname ?? "없음"})을 써요. 별명은 나에게만 보여요.
        </p>
        <SubmitButton pendingText="저장하는 중…" className="mt-4 min-h-12 w-full rounded-sm bg-navy py-3 text-t2 text-white hover:bg-navy-hover active:bg-navy-active">
          이 별명으로 시작하기
        </SubmitButton>
      </form>

      {/* 돌아갈 곳이 찜·신청 저장 주소(/wish, /plan)일 수 있어 미리 불러오지 않도록 <a> 를 쓴다 */}
      <a href={next} className="mt-2 flex min-h-11 w-full items-center justify-center text-l1 text-ink-2 hover:text-navy">
        나중에 할게요
      </a>
    </div>
  );
}
