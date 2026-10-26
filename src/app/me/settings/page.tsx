import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";
import { PushSettings } from "@/components/PushSettings";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getPushPrefs, isPushEnabled, vapidPublicKey } from "@/lib/push";
import { DEFAULT_PUSH_PREFS } from "@/lib/push-shared";

export const metadata: Metadata = { title: "환경설정", robots: { index: false } };

export default async function SettingsPage() {
  // 로그인·알림 열쇠 유무는 배포 환경에서 판단해야 하므로, 방문할 때마다 그린다
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me/settings");

  const pushReady = isPushEnabled();
  // 0025 설정문 실행 전이면 기본값(모두 켬)으로 보여 준다
  const prefs = pushReady
    ? await getPushPrefs(user.id).catch((e) => {
        console.error("[owl] push prefs load failed", e);
        return DEFAULT_PUSH_PREFS;
      })
    : DEFAULT_PUSH_PREFS;

  return (
    <div className="pt-2">
      <Link href="/me" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        마이페이지
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">환경설정</h1>

      <section aria-labelledby="push-title" className="mt-6">
        <h2 id="push-title" className="text-t1 text-ink">
          알림
        </h2>
        <p className="mt-1 text-b2 text-ink-2">찜해 둔 모임·책방·전시를 잊지 않게, 필요한 날 아침에 알려드려요.</p>
        <div className="mt-4">
          {pushReady ? (
            <PushSettings vapidKey={vapidPublicKey()!} initialPrefs={prefs} />
          ) : (
            <p className="rounded-md border border-border-card bg-sub p-4 text-b2 text-ink-2">알림 기능을 준비하고 있어요. 조금만 기다려 주세요.</p>
          )}
        </div>
      </section>
    </div>
  );
}
