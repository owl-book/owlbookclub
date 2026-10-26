import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminNav } from "@/components/AdminNav";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getAdminStats, type EmptySearch, type StatRow, type Stats, type StoreStatRow } from "@/lib/admin-stats";
import { getCoverBooks } from "@/lib/book-covers";
import { count } from "@/lib/format";
import { getReviewCount } from "@/lib/review";
import { getInquiryInbox, getReportInbox } from "@/lib/reports";
import { formatKst } from "@/lib/time";

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
          <Table title="책방별" firstHead="책방" rows={stats.stores} columns={STORE_COLUMNS} hrefOf={(id) => `/s/${id}`} minWidth="min-w-[52rem]" />
          <Table title="모임별" firstHead="모임" rows={stats.meetings} columns={MEETING_COLUMNS} hrefOf={(id) => `/m/${id}`} minWidth="min-w-[34rem]" />
          <EmptySearches items={stats.emptySearches} />
          <section className="mt-8 rounded-md border border-border-card bg-sub p-4 text-l2 font-normal leading-normal text-ink-2">
            <p className="font-semibold text-ink">숫자 읽는 법</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li><strong>카드 클릭</strong>: 목록에서 모임 카드를 눌러 상세 화면으로 간 횟수예요.</li>
              <li><strong>신청하기</strong>: 책방 신청 페이지·원 게시물로 나간 횟수예요(같은 사람이 여러 번 누르면 여러 번 세요).</li>
              <li><strong>찜</strong>: 모임 표는 모임 하트, 책방 표는 책방 자체의 하트예요. 그 기간에 누른 것 중 지금도 남아 있는 것만 세요. 로그인한 사람의 하트만 저장돼요.</li>
              <li><strong>내 모임에 담음</strong>: ‘책방에서 신청했어요’로 표시한 수예요. 책방 표는 그 책방 모임들의 합이에요.</li>
              <li><strong>화면 조회</strong>: 책방 상세 화면이 열린 횟수예요(같은 사람이 다시 열면 다시 세요).</li>
              <li><strong>지도·전화·인스타</strong>: 책방 화면의 ‘지도’·‘전화’·‘책방 계정 보기’를 누른 횟수예요. 지도는 모임·전시 화면의 ‘지도’도 함께 세요.</li>
              <li><strong>결과 0건 검색</strong>: 홈에서 검색·필터·날짜를 바꿨는데 맞는 모임이 없었던 조건이에요. 검색어의 이메일·전화번호 모양은 [가림]으로 바꿔 저장해요.</li>
              <li>카드 클릭·화면 조회·지도·전화·인스타·결과 0건은 0026 설정문을 실행한 뒤부터 쌓여요.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

type Column<R> = { key: keyof R & string; label: string; strong?: boolean };

const MEETING_COLUMNS: Column<StatRow>[] = [
  { key: "card", label: "카드 클릭" },
  { key: "apply", label: "신청하기", strong: true },
  { key: "wish", label: "찜" },
  { key: "plan", label: "내 모임에 담음" },
];

const STORE_COLUMNS: Column<StoreStatRow>[] = [
  { key: "view", label: "화면 조회" },
  { key: "card", label: "카드 클릭" },
  { key: "apply", label: "신청하기", strong: true },
  { key: "wish", label: "책방 찜" },
  { key: "plan", label: "내 모임에 담음" },
  { key: "map", label: "지도" },
  { key: "tel", label: "전화" },
  { key: "instagram", label: "인스타" },
];

function Table<R extends StatRow>({
  title,
  firstHead,
  rows,
  columns,
  hrefOf,
  minWidth,
}: {
  title: string;
  firstHead: string;
  rows: R[];
  columns: Column<R>[];
  hrefOf: (id: number) => string;
  minWidth: string;
}) {
  const sum = (k: keyof R) => rows.reduce((n, r) => n + Number(r[k]), 0);
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="text-t2 text-ink">
        {title} <span className="text-l1 text-ink-3">{rows.length}곳</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-b2 text-ink-3">이 기간에 쌓인 숫자가 없어요.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xs border border-border-card">
          <table className={`w-full ${minWidth} border-collapse text-left text-l1`}>
            <thead className="bg-sub text-l2 text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{firstHead}</th>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-card align-top">
                  <th scope="row" className="px-3 py-2 font-normal text-ink">
                    <Link href={hrefOf(r.id)} className="underline underline-offset-2 hover:text-navy">
                      {r.name}
                    </Link>
                    {r.sub && <span className="mt-0.5 block text-l2 text-ink-3">{r.sub}</span>}
                  </th>
                  {columns.map((c) => (
                    <td key={c.key} className={`fig px-3 py-2 text-right ${c.strong ? "font-semibold" : ""}`}>
                      {Number(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-sub text-ink">
              <tr>
                <th scope="row" className="px-3 py-2 font-semibold">합계</th>
                {columns.map((c) => (
                  <td key={c.key} className="fig px-3 py-2 text-right font-semibold">
                    {sum(c.key)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// 결과 0건 검색: 많이 나온 조건 순, 최대 20개
function EmptySearches({ items }: { items: EmptySearch[] }) {
  return (
    <section aria-label="결과 0건 검색" className="mt-6">
      <h2 className="text-t2 text-ink">
        결과 0건 검색 <span className="text-l1 text-ink-3">많이 나온 순 {items.length}개</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-b2 text-ink-3">이 기간에 결과가 0건이었던 검색이 없어요.</p>
      ) : (
        <ol className="mt-2 divide-y divide-border-card rounded-xs border border-border-card">
          {items.map((it) => (
            <li key={it.label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-l1">
              <span className="min-w-0 break-keep text-ink">{it.label}</span>
              <span className="shrink-0 text-right text-l2 text-ink-3">
                <span className="fig font-semibold text-ink">{count(it.count, "번")}</span> · 마지막 <span className="fig">{formatKst(it.last)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
