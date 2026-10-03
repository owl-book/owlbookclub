import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { RatingInput } from "@/components/RatingInput";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getMeetingForRecord, getRecord } from "@/lib/me";
import { deleteRecord, saveRecord } from "@/lib/me-actions";
import { isPast } from "@/lib/meetings";
import { formatKst } from "@/lib/time";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";

export const metadata: Metadata = { title: "모임 기록", robots: { index: false } };

const field = "w-full rounded-xs border border-border-control bg-card px-3 py-2.5 text-b1 text-ink placeholder:text-ink-3";

export default async function RecordPage({ params }: PageProps<"/me/records/[meetingId]">) {
  if (!isAuthEnabled()) notFound();
  const { meetingId } = await params;
  const id = Number(meetingId);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/me/records/${meetingId}`)}`);

  const meeting = await getMeetingForRecord(id);
  if (!meeting) notFound();
  const record = await getRecord(user.id, meeting.id);

  return (
    <div className="pt-2">
      <Link href="/me?tab=mine" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        마이페이지
      </Link>

      <h1 className="mt-1 font-display text-h2 text-ink">{record ? "내 모임 기록" : "모임 기록하기"}</h1>

      {/* 게재가 내려간 책방의 모임은 상세 화면이 없으므로 링크 없이 보여 준다 */}
      {meeting.hidden ? (
        <div className="mt-4 rounded-md border border-border-card bg-sub p-4">
        <p className="text-l2 font-normal text-ink-3">
          {formatKst(meeting.startsAt)} · {meeting.store.name}
        </p>
        <p className="mt-1 text-t2 text-ink">{meeting.title}</p>
        {meeting.bookTitle && (
          <p className="mt-0.5 text-b2 text-ink-2">
            『{meeting.bookTitle}』{meeting.bookAuthor && ` ${meeting.bookAuthor}`}
          </p>
        )}
      </div>
      ) : (
        <Link href={`/m/${meeting.id}`} className="mt-4 block rounded-md border border-border-card bg-sub p-4 hover:border-border-strong">
        <p className="text-l2 font-normal text-ink-3">
          {formatKst(meeting.startsAt)} · {meeting.store.name}
        </p>
        <p className="mt-1 text-t2 text-ink">{meeting.title}</p>
        {meeting.bookTitle && (
          <p className="mt-0.5 text-b2 text-ink-2">
            『{meeting.bookTitle}』{meeting.bookAuthor && ` ${meeting.bookAuthor}`}
          </p>
        )}
      </Link>
      )}

      {!isPast(meeting) ? (
        <div className="mt-6 rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
          <p className="text-t2 text-ink">아직 열리지 않은 모임이에요</p>
          <p className="mt-1 text-b2 text-ink-2">모임 날짜가 지나면 기록을 남길 수 있어요.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-l2 font-normal text-ink-3">🔒 이 기록은 나만 볼 수 있어요. 책방이나 다른 사람에게 보이지 않아요. 모든 칸은 비워 둬도 돼요.</p>

          <form action={saveRecord} className="mt-5 space-y-6">
            <input type="hidden" name="meetingId" value={meeting.id} />

            <div>
              <p className="mb-1 text-l1 font-semibold text-ink">만족도</p>
              <RatingInput name="rating" initial={record?.rating ?? null} />
            </div>

            <div>
              <label htmlFor="quote" className="mb-1.5 block text-l1 font-semibold text-ink">
                인상 깊은 문장
              </label>
              <textarea
                id="quote"
                name="quote"
                rows={3}
                maxLength={500}
                defaultValue={record?.quote ?? ""}
                placeholder="책에서, 또는 모임에서 누군가 한 말 중 마음에 남은 문장"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="memo" className="mb-1.5 block text-l1 font-semibold text-ink">
                자유 메모
              </label>
              <textarea
                id="memo"
                name="memo"
                rows={8}
                maxLength={5000}
                defaultValue={record?.memo ?? ""}
                placeholder="모임에서 나눈 이야기, 새로 알게 된 것, 다음에 읽고 싶은 책…"
                className={field}
              />
            </div>

            <button type="submit" className="min-h-12 w-full rounded-sm bg-navy py-3.5 text-t2 text-white hover:bg-navy-hover active:bg-navy-active">
              {record ? "수정한 내용 저장" : "기록 저장"}
            </button>
          </form>

          {record && (
            <form action={deleteRecord} className="mt-6 text-center">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <ConfirmSubmit message="이 기록을 지울까요? 지운 기록은 되살릴 수 없어요." className="inline-flex min-h-11 items-center text-l2 text-error underline">
                이 기록 지우기
              </ConfirmSubmit>
            </form>
          )}
        </>
      )}
    </div>
  );
}
