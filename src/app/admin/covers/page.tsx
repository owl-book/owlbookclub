import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { CoverUploadForm } from "@/components/CoverUploadForm";
import { SubmitButton } from "@/components/SubmitButton";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getCoverBooks, type CoverBook } from "@/lib/book-covers";
import { removeBookCover } from "@/lib/cover-actions";
import { formatKst } from "@/lib/time";

// 운영자 전용 책 표지 화면. 모임에 적힌 책 제목을 책마다 하나로 묶어 보여 주고, 책마다 사진을 한 번 올린다.
// 신고함과 마찬가지로 사이트 어디에도 링크하지 않고, 화면·동작 모두 출입증을 확인한다.
export const metadata: Metadata = { title: "책 표지", robots: { index: false, follow: false } };

const DONE_MESSAGE: Record<string, string> = {
  upload: "사진을 올렸어요. 이 책을 읽는 모임 카드에 모두 보여요.",
  replace: "사진을 바꿨어요.",
  remove: "사진을 뺐어요.",
};

export default async function AdminCoversPage({ searchParams }: PageProps<"/admin/covers">) {
  await connection();
  if (!isAdminEnabled()) notFound();
  if (!(await isAdmin())) return <AdminLogin />;

  const sp = await searchParams;
  const done = typeof sp.done === "string" ? DONE_MESSAGE[sp.done] : undefined;
  const books = await getCoverBooks();
  const missing = books.filter((b) => !b.cover).length;

  return (
    <div className="pt-5">
      <Link href="/admin/reports" className="inline-flex min-h-11 items-center text-l1 text-ink-2 underline underline-offset-2 hover:text-navy">
        신고함으로
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">책 표지</h1>
      <p className="mt-1 text-b2 text-ink-2">
        {books.length === 0 ? (
          "모임에 책 제목이 들어가면 여기에 책이 모여요."
        ) : missing > 0 ? (
          <>
            사진이 없는 책 <strong className="text-ink">{missing}권</strong> · 전체 {books.length}권
          </>
        ) : (
          `모든 책에 사진이 있어요 · 전체 ${books.length}권`
        )}
      </p>
      <p className="mt-2 text-b2 text-ink-2">
        제목이 같은 책은 한 번만 올리면 돼요. 책을 직접 찍은 사진이나 책방·출판사에서 받은 사진을 써 주세요.
      </p>

      {done && (
        <p role="status" className="mt-4 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          {done}
        </p>
      )}

      {books.length > 0 && (
        <ul className="mt-5 space-y-3">
          {books.map((b) => (
            <BookRow key={b.key} book={b} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BookRow({ book: b }: { book: CoverBook }) {
  return (
    <li className="rounded-md border border-border-card bg-card p-4">
      <div className="flex gap-3.5">
        {b.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.cover.url} alt={`『${b.title}』 표지`} className="h-[108px] w-[72px] shrink-0 rounded-xs object-cover ring-1 ring-border" />
        ) : (
          <div className="flex h-[108px] w-[72px] shrink-0 items-center justify-center rounded-xs bg-fill text-center text-l2 text-ink-2 ring-1 ring-border">
            사진 없음
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-t2 text-ink">『{b.title}』</h2>
          {b.author && <p className="mt-0.5 text-b2 text-ink-2">{b.author}</p>}
          <p className="mt-1 text-b2 text-ink-2">
            모임 {b.meetingCount}개{b.nextAt ? ` · 다음 모임 ${formatKst(new Date(b.nextAt))}` : " · 다가오는 모임 없음"}
          </p>
        </div>
      </div>

      <CoverUploadForm title={b.title} hasCover={Boolean(b.cover)} />

      {b.cover && (
        <form action={removeBookCover} className="mt-1">
          <input type="hidden" name="key" value={b.key} />
          <SubmitButton
            pendingText="빼는 중…"
            confirm={`『${b.title}』 사진을 뺄까요? 이 책을 읽는 모임 카드에는 다시 사진 대신 책 제목이 보여요.`}
            className="inline-flex min-h-11 items-center text-l1 text-ink-2 underline underline-offset-2 hover:text-error"
          >
            사진 빼기
          </SubmitButton>
        </form>
      )}
    </li>
  );
}
