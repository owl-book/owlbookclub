import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminNav } from "@/components/AdminNav";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getAdminStats, type StatRow, type Stats } from "@/lib/admin-stats";
import { getCoverBooks } from "@/lib/book-covers";
import { getReviewCount } from "@/lib/review";
import { getInquiryInbox, getReportInbox } from "@/lib/reports";

// 운영자 전용 통계: 모임별·책방별 카드 클릭 · 신청하기 클릭 · 찜 · 내 모임에 담은 수. 홈 화면 개선 전후를 날짜로 나눠 비교하는 용도.
export const metadata: Metadata = { title: "통계", robots: { index: false, follow: false } };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 한국 시간 기준 오늘 날짜(YYYY-MM-DD)
function kstDay(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

export default async function AdminStatsPage({ searchParams }: PageProps<"/admin/stats">) {
  await connection();
  if (!isAdminEnabled()) notFound();
  if (!(await isAdmin())) return <AdminLogin next="/admin/stats" />;

  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" && DATE_RE.test(sp[k] as string) ? (sp[k] as string) : null);
  const today = kstDay();
  let to = pick("to") ?? today;
  let from = pick("from") ?? kstDay(-6);
  if (from > to) [from, to] = [to, from];

  const [stats, inbox, inquiries, books, reviewCount] = await Promise.all([
    getAdminStats(from, to).catch((e): Stats | null => {
      console.error("[owl] admin stats load failed", e);
      return null;
    }),
    getReportInbox(),
    getInquiryInbox(),
    getCoverBooks(),
    getReviewCount(),
  ]);
  const reportCount = inbox.reduce((n, item) => n + item.reports.length, 0) + inquiries.length;
  const presets = [
    { label: "오늘", from: today, to: today },
    { label: "최근 7일", from: kstDay(-6), to: today },
    { label: "최근 30일", from: kstDay(-29), to: today },
  ];

  return (
    <div>
      <AdminNav current="stats" counts={{ review: reviewCount, reports: reportCount, covers: books.filter((b) => !b.cover).length }} />
      <h1 className="mt-5 font-display text-h2 text-ink">통계</h1>
      <p className="mt-1 text-b2 text-ink-2">운영자 기기와 봇은 빼고 센 숫자예요. 한국 시간 날짜 기준이에요.</p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-l2 text-ink-2">
          시작일
          <input type="date" name="from" defaultValue={from} className="mt-1 block min-h-11 rounded-xs border border-border-control bg-card px-3 text-b1 text-ink" />
        </label>
        <label className="text-l2 text-ink-2">
          끝일
          <input type="date" name="to" defaultValue={to} className="mt-1 block min-h-11 rounded-xs border border-border-control bg-card px-3 text-b1 text-ink" />
        </label>
        <button type="submit" className="min-h-11 rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover">
          보기
        </button>
      </form>
      <ul className="mt-2 flex flex-wrap gap-2">
        {presets.map((p) => (
          <li key={p.label}>
            <Link href={`/admin/stats?from=${p.from}&to=${p.to}`} className="inline-flex min-h-11 items-center rounded-xs bg-fill px-3.5 text-l1 text-ink-2 hover:text-ink">
              {p.label}
            </Link>
          </li>
        ))}
      </ul>

      {!stats ? (
        <p className="mt-6 rounded-md border border-border-card bg-sub p-4 text-b2 text-ink-2">통계를 읽지 못했어요. 잠시 뒤 다시 열어 보고, 계속 안 되면 알려 주세요.</p>
      ) : (
        <>
          <Table title="책방별" firstHead="책방" rows={stats.stores} storeMode />
          <Table title="모임별" firstHead="모임" rows={stats.meetings} />
          {stats.storeWishOnly > 0 && <p className="mt-3 text-l2 text-ink-3">모임이 없는 책방에 눌린 책방 하트 {stats.storeWishOnly}개는 표에 넣지 않았어요.</p>}
          <section className="mt-8 rounded-md border border-border-card bg-sub p-4 text-l2 font-normal leading-normal text-ink-2">
            <p className="font-semibold text-ink">숫자 읽는 법</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li><strong>카드 클릭</strong>: 목록에서 모임 카드를 눌러 상세 화면으로 간 횟수예요. 카드 클릭 기록은 0026 설정문을 실행한 뒤부터 쌓여요.</li>
              <li><strong>신청하기</strong>: 책방 신청 페이지·원 게시물로 나간 횟수예요(같은 사람이 여러 번 누르면 여러 번 세요).</li>
              <li><strong>찜</strong>: 모임 표는 모임 하트, 책방 표는 책방 자체의 하트예요. 그 기간에 누른 것 중 지금도 남아 있는 것만 세요. 로그인한 사람의 하트만 저장돼요.</li>
              <li><strong>내 모임에 담음</strong>: ‘책방에서 신청했어요’로 표시한 수예요. 책방 표는 그 책방 모임들의 합이에요.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Table({ title, firstHead, rows, storeMode = false }: { title: string; firstHead: string; rows: StatRow[]; storeMode?: boolean }) {
  const sum = (k: "card" | "apply" | "wish" | "plan") => rows.reduce((n, r) => n + r[k], 0);
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="text-t2 text-ink">
        {title} <span className="text-l1 text-ink-3">{rows.length}곳</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-b2 text-ink-3">이 기간에 쌓인 숫자가 없어요.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xs border border-border-card">
          <table className="w-full min-w-[34rem] border-collapse text-left text-l1">
            <thead className="bg-sub text-l2 text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{firstHead}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">카드 클릭</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">신청하기</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{storeMode ? "책방 찜" : "찜"}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">내 모임에 담음</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-card align-top">
                  <th scope="row" className="px-3 py-2 font-normal text-ink">
                    <Link href={storeMode ? `/s/${r.id}` : `/m/${r.id}`} className="underline underline-offset-2 hover:text-navy">
                      {r.name}
                    </Link>
                    {r.sub && <span className="mt-0.5 block text-l2 text-ink-3">{r.sub}</span>}
                  </th>
                  <td className="fig px-3 py-2 text-right">{r.card}</td>
                  <td className="fig px-3 py-2 text-right font-semibold">{r.apply}</td>
                  <td className="fig px-3 py-2 text-right">{r.wish}</td>
                  <td className="fig px-3 py-2 text-right">{r.plan}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-sub text-ink">
              <tr>
                <th scope="row" className="px-3 py-2 font-semibold">합계</th>
                <td className="fig px-3 py-2 text-right font-semibold">{sum("card")}</td>
                <td className="fig px-3 py-2 text-right font-semibold">{sum("apply")}</td>
                <td className="fig px-3 py-2 text-right font-semibold">{sum("wish")}</td>
                <td className="fig px-3 py-2 text-right font-semibold">{sum("plan")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
