import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { editMeeting, logoutAdmin, resolveReport } from "@/lib/admin-actions";
import { reportKindLabel } from "@/lib/report-kinds";
import { getRecentHandled, getReportInbox, type InboxItem } from "@/lib/reports";
import { formatDateString, formatKst } from "@/lib/time";

// 운영자 전용 신고함. 사이트 어디에도 링크하지 않고, 검색에도 나오지 않게 한다(next.config 의 noindex 머리말과 함께).
// 보안은 주소를 숨기는 데 기대지 않는다: 화면은 출입증이 있을 때만 그리고, 버튼 동작도 각자 출입증을 다시 확인한다.
export const metadata: Metadata = { title: "신고함", robots: { index: false, follow: false } };

const ACTION_LABEL: Record<string, string> = {
  close: "마감으로 표시",
  hide: "숨김",
  edit: "내용 고침",
  ok: "문제없음",
};

const DONE_MESSAGE: Record<string, string> = {
  close: "마감으로 표시했어요.",
  hide: "모임을 숨겼어요.",
  edit: "고친 내용을 저장했어요.",
  ok: "문제없음으로 닫고 확인일을 오늘로 바꿨어요.",
};

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  // 조립(빌드) 때 미리 그려 두지 않고 요청마다 확인한다: 조립 시점에 비밀번호 설정이 없으면 '없는 페이지'로 굳어 버리지 않게
  await connection();
  // 비밀번호가 설정되지 않았으면 이 주소가 있다는 것도 알리지 않는다
  if (!isAdminEnabled()) notFound();
  if (!(await isAdmin())) return <AdminLogin />;

  const sp = await searchParams;
  const done = typeof sp.done === "string" ? DONE_MESSAGE[sp.done] : undefined;
  const [inbox, handled] = await Promise.all([getReportInbox(), getRecentHandled()]);
  const reportCount = inbox.reduce((n, item) => n + item.reports.length, 0);
  const now = new Date();

  return (
    <div className="pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 text-ink">신고함</h1>
          <p className="mt-1 text-b2 text-ink-2">
            {reportCount > 0 ? (
              <>
                처리 전 <strong className="text-ink">{reportCount}건</strong> · 모임 {inbox.length}곳
              </>
            ) : (
              "처리 전 신고가 없어요"
            )}
          </p>
        </div>
        <form action={logoutAdmin}>
          <button type="submit" className="inline-flex min-h-11 items-center px-2 text-l2 text-ink-3 underline underline-offset-2 hover:text-navy">
            나가기
          </button>
        </form>
      </div>

      {done && (
        <p role="status" className="mt-4 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          {done}
        </p>
      )}

      {inbox.length === 0 ? (
        <p className="mt-6 rounded-md bg-sub px-4 py-6 text-center text-b2 text-ink-2">
          새 신고가 들어오면 여기에 모여요.
          <br />
          모임 상세화면의 ‘알려주기’로 들어온 신고만 보여요.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {inbox.map((item) => (
            <ReportCard key={item.meeting.id} item={item} now={now} />
          ))}
        </ul>
      )}

      {handled.length > 0 && (
        <section aria-labelledby="handled-title" className="mt-10">
          <h2 id="handled-title" className="text-t2 text-ink">
            최근 처리
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {handled.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2.5 text-b2">
                <span className="min-w-0 truncate text-ink-2">{h.meetingTitle}</span>
                <span className="shrink-0 text-l2 text-ink-3">
                  {ACTION_LABEL[h.action] ?? h.action} · {timeAgo(h.createdAt, now)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-l2 font-normal text-ink-3">바꾸기 전 값은 Supabase의 admin_actions 표에 남아 있어요.</p>
        </section>
      )}
    </div>
  );
}

function ReportCard({ item, now }: { item: InboxItem; now: Date }) {
  const m = item.meeting;
  const past = m.startsAt.getTime() < now.getTime();
  const closed = m.status === "closed";
  const titleId = `meeting-${m.id}-title`;

  return (
    <li aria-labelledby={titleId} className="rounded-md border border-border-card bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {m.hidden && <Badge>숨김</Badge>}
        {closed && <Badge>마감됨</Badge>}
        {past && <Badge>지난 모임</Badge>}
      </div>
      <h3 id={titleId} className="text-t2 text-ink">
        {m.hidden ? (
          m.title
        ) : (
          <a href={`/m/${m.id}`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            {m.title}
          </a>
        )}
      </h3>
      <p className="mt-0.5 text-l2 font-normal text-ink-3">
        {m.storeName} · {formatKst(m.startsAt)}
      </p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xs bg-sub px-3 py-2 text-l2 font-normal">
        <dt className="text-ink-3">장소 설명</dt>
        <dd className="text-ink-2">{m.place ?? "없음"}</dd>
        <dt className="text-ink-3">참가비</dt>
        <dd className="text-ink-2">{m.feeText ?? "없음"}</dd>
        <dt className="text-ink-3">확인일</dt>
        <dd className="text-ink-2">{formatDateString(m.lastCheckedAt)}</dd>
      </dl>

      {/* 신고 내용은 누구나 쓸 수 있으므로 글자로만 보여 준다(주소가 있어도 누를 수 없게) */}
      <ul className="mt-3 space-y-2.5">
        {item.reports.map((r) => (
          <li key={r.id} className="border-l-2 border-border-strong pl-3">
            <p className="text-l2">
              <span className="font-semibold text-ink">{reportKindLabel(r.kind)}</span>
              <span className="font-normal text-ink-3"> · {timeAgo(r.createdAt, now)}</span>
            </p>
            {r.message && <p className="mt-0.5 whitespace-pre-wrap break-words text-b2 text-ink-2">{r.message}</p>}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <form action={resolveReport}>
          <input type="hidden" name="meetingId" value={m.id} />
          <input type="hidden" name="action" value="close" />
          <button
            type="submit"
            disabled={closed}
            className="min-h-11 w-full rounded-sm bg-navy px-2 py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover disabled:bg-fill disabled:text-ink-3"
          >
            {closed ? "이미 마감됨" : "마감으로 표시"}
          </button>
        </form>
        <form action={resolveReport}>
          <input type="hidden" name="meetingId" value={m.id} />
          <input type="hidden" name="action" value="ok" />
          <button type="submit" className="flex min-h-11 w-full flex-col items-center justify-center rounded-sm border border-border-strong bg-card px-2 py-1.5 hover:bg-sub">
            <span className="text-l1 font-semibold text-navy">문제없음</span>
            <span className="text-l2 font-normal text-ink-3">확인일만 오늘로</span>
          </button>
        </form>
      </div>

      <details className="group mt-2 rounded-sm border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-l1 font-semibold text-navy [&::-webkit-details-marker]:hidden">
          일정·장소·참가비 고치기
          <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <form action={editMeeting} className="space-y-3 border-t border-border px-3 pt-3 pb-3">
          <input type="hidden" name="meetingId" value={m.id} />
          <Field label="일시" htmlFor={`starts-${m.id}`}>
            <input id={`starts-${m.id}`} name="startsAt" type="datetime-local" required defaultValue={toKstInput(m.startsAt)} className={inputClass} />
          </Field>
          <Field label="장소 설명" htmlFor={`place-${m.id}`} hint="책방 주소는 Supabase의 stores 표에서 고쳐요">
            <input id={`place-${m.id}`} name="place" type="text" maxLength={200} defaultValue={m.place ?? ""} className={inputClass} />
          </Field>
          <Field label="참가비" htmlFor={`fee-${m.id}`}>
            <input id={`fee-${m.id}`} name="feeText" type="text" maxLength={100} defaultValue={m.feeText ?? ""} placeholder="예: 2만원(음료 포함)" className={inputClass} />
          </Field>
          <button type="submit" className="min-h-11 w-full rounded-sm bg-navy py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover">
            고친 내용 저장
          </button>
        </form>
      </details>

      {!m.hidden && (
        <form action={resolveReport} className="mt-1 flex justify-end">
          <input type="hidden" name="meetingId" value={m.id} />
          <input type="hidden" name="action" value="hide" />
          <ConfirmSubmit
            message="이 모임을 숨길까요? 목록·상세에서 사라지고, 찜하거나 담아 둔 사람에게만 글자로 남아요."
            className="inline-flex min-h-11 items-center px-2 text-l2 text-error underline underline-offset-2"
          >
            모임 숨기기
          </ConfirmSubmit>
        </form>
      )}
    </li>
  );
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xs border border-border-control bg-card px-3 text-b2 text-ink focus:border-navy focus:outline-2 focus:outline-navy";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-l2 font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-l2 font-normal text-ink-3">{hint}</p>}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 rounded-xs bg-fill px-1.5 py-0.5 text-l2 text-ink-2">{children}</span>;
}

// <input type="datetime-local"> 에 넣을 한국 시간 '2026-10-08T19:30'
function toKstInput(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
}

function timeAgo(d: Date, now: Date): string {
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}일 전` : formatDateString(new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10));
}
