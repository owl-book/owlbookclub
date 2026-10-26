import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminNav } from "@/components/AdminNav";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getCoverBooks } from "@/lib/book-covers";
import { isPushEnabled } from "@/lib/push";
import { PUSH_PREF_ITEMS } from "@/lib/push-shared";
import { getPushStats, PUSH_GOAL, type PushStats } from "@/lib/push-stats";
import { getReviewCount } from "@/lib/review";
import { getInquiryInbox, getReportInbox } from "@/lib/reports";
import { formatDayNum } from "@/lib/time";

// 운영자 전용 알림 숫자. 알림을 켠 사람이 기획서 기준(20명)에 얼마나 왔는지, 보낸 알림을 몇 명이 열어 봤는지 본다.
// 열어 본 비율이 낮으면 카카오 알림톡으로 옮길지 판단하는 근거가 된다. 누구인지는 보여 주지 않는다.
export const metadata: Metadata = { title: "알림", robots: { index: false, follow: false } };

const PLATFORM_LABEL = { ios: "아이폰·아이패드", android: "안드로이드", desktop: "컴퓨터", other: "기타" } as const;

export default async function AdminPushPage() {
  await connection();
  if (!isAdminEnabled()) notFound();
  if (!(await isAdmin())) return <AdminLogin next="/admin/push" />;

  const [stats, inbox, inquiries, books, reviewCount] = await Promise.all([
    // 0025 설정문 실행 전이면 null → 안내만 보여 준다
    getPushStats().catch((e): PushStats | null => {
      console.error("[owl] push stats load failed", e);
      return null;
    }),
    getReportInbox(),
    getInquiryInbox(),
    getCoverBooks(),
    getReviewCount(),
  ]);
  const reportCount = inbox.reduce((n, item) => n + item.reports.length, 0) + inquiries.length;

  return (
    <div>
      <AdminNav current="push" counts={{ review: reviewCount, reports: reportCount, covers: books.filter((b) => !b.cover).length }} />
      <h1 className="mt-5 font-display text-h2 text-ink">알림</h1>
      <p className="mt-1 text-b2 text-ink-2">운영자 기기와 시험 알림은 빼고 세요. 사람 수만 보여 주고 누구인지는 보여 주지 않아요.</p>

      {!isPushEnabled() && (
        <p className="mt-4 rounded-xs border border-warning-border bg-warning-surface px-3 py-2.5 text-b2 text-warning">
          알림 열쇠(NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)가 이 사이트 설정에 없어서 알림 기능이 꺼져 있어요.
        </p>
      )}

      {!stats ? (
        <p className="mt-6 rounded-md border border-border-card bg-sub p-4 text-b2 text-ink-2">
          알림 숫자를 읽지 못했어요. Supabase 에서 0025 설정문을 실행했는지 확인해 주세요.
        </p>
      ) : (
        <StatsView stats={stats} />
      )}
    </div>
  );
}

function StatsView({ stats }: { stats: PushStats }) {
  const goalPct = Math.min(100, Math.round((stats.people / PUSH_GOAL) * 100));
  const rate = (opened: number, sent: number) => (sent > 0 ? `${Math.round((opened / sent) * 100)}%` : "–");

  return (
    <>
      {/* 가장 중요한 두 숫자: 켠 사람(목표 대비), 열어 본 비율 */}
      <section aria-label="요약" className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border-card bg-card p-4">
          <p className="text-l1 text-ink-2">알림 켠 사람</p>
          <p className="mt-1 font-display text-h1 leading-none text-ink">
            {stats.people}
            <span className="ml-1 font-body text-b2 text-ink-3">/ {PUSH_GOAL}명</span>
          </p>
          <div
            role="progressbar"
            aria-label="목표 20명 대비"
            aria-valuemin={0}
            aria-valuemax={PUSH_GOAL}
            aria-valuenow={Math.min(stats.people, PUSH_GOAL)}
            className="mt-3 h-2 overflow-hidden rounded-full bg-fill"
          >
            <div className="h-full rounded-full bg-navy" style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-1.5 text-l2 font-normal text-ink-3">기획서 기준: 6개월 안에 {PUSH_GOAL}명</p>
        </div>
        <div className="rounded-md border border-border-card bg-card p-4">
          <p className="text-l1 text-ink-2">열어 본 비율</p>
          <p className="mt-1 font-display text-h1 leading-none text-ink">{rate(stats.total.opened, stats.total.sent)}</p>
          <p className="mt-3 text-l2 font-normal text-ink-3">
            지금까지 보낸 {stats.total.sent}통 중 {stats.total.opened}통을 눌러서 열었어요
          </p>
        </div>
      </section>

      <section aria-labelledby="weeks-title" className="mt-8">
        <h2 id="weeks-title" className="text-t2 text-ink">최근 4주</h2>
        <p className="mt-0.5 text-l2 font-normal text-ink-3">아침에 모아 보낸 알림 한 통을 1로 세요. 주는 일요일부터 토요일까지예요.</p>
        <table className="mt-3 w-full border-collapse text-left text-b2">
          <thead>
            <tr className="border-b border-border-strong text-l1 text-ink-2">
              <th scope="col" className="py-2 font-medium">주</th>
              <th scope="col" className="py-2 text-right font-medium">보냄</th>
              <th scope="col" className="py-2 text-right font-medium">열어 봄</th>
              <th scope="col" className="py-2 text-right font-medium">비율</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.weeks].reverse().map((w, i) => (
              <tr key={w.start} className="border-b border-border">
                <th scope="row" className="py-2.5 font-normal text-ink">
                  {formatDayNum(w.start).replace(/ \(.\)$/, "")}~{i === 0 && <span className="ml-1 text-l2 text-ink-3">이번 주</span>}
                </th>
                <td className="py-2.5 text-right tabular-nums text-ink">{w.sent}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">{w.opened}</td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-ink">{rate(w.opened, w.sent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="prefs-title" className="mt-8">
        <h2 id="prefs-title" className="text-t2 text-ink">종류별로 켠 사람</h2>
        <ul className="mt-3 space-y-2.5">
          {PUSH_PREF_ITEMS.map((item) => (
            <Bar key={item.key} label={item.label} value={stats.byPref[item.key]} max={stats.people} unit="명" />
          ))}
        </ul>
      </section>

      <section aria-labelledby="devices-title" className="mt-8">
        <h2 id="devices-title" className="text-t2 text-ink">기기</h2>
        <p className="mt-0.5 text-l2 font-normal text-ink-3">
          알림 받는 기기 {stats.devices}대 · 홈 화면 앱에서 켠 기기 {stats.installed}대
        </p>
        <ul className="mt-3 space-y-2.5">
          {(Object.keys(PLATFORM_LABEL) as (keyof typeof PLATFORM_LABEL)[])
            .filter((k) => k !== "other" || stats.byPlatform.other > 0)
            .map((k) => (
              <Bar key={k} label={PLATFORM_LABEL[k]} value={stats.byPlatform[k]} max={stats.devices} unit="대" />
            ))}
        </ul>
      </section>
    </>
  );
}

function Bar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li>
      <p className="flex items-baseline justify-between text-l1 text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums text-ink">
          {value}
          {unit}
        </span>
      </p>
      <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full bg-slate" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
