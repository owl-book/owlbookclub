import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyButton } from "@/components/ApplyButton";
import { BackLink } from "@/components/BackLink";
import { ReportLink } from "@/components/ReportLink";
import { ShareButton } from "@/components/ShareButton";
import { GenreTag, PlainTag, StatusBadge } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";
import { getRecord, getWishContext } from "@/lib/me";
import { getMeeting, isPast } from "@/lib/meetings";
import { formatDateString, formatKst, relativeDayLabel } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = await getMeeting(Number(id));
  if (!m) return { title: "모임을 찾을 수 없어요" };
  const description = `${formatKst(m.startsAt)} · ${m.store.name}(${m.store.region})${m.bookTitle ? ` · 『${m.bookTitle}』` : ""}`;
  return {
    title: `${m.title} | ${m.store.name}`,
    description,
    openGraph: { title: `${m.title} | ${m.store.name}`, description },
    alternates: { canonical: `/m/${m.id}` },
  };
}

export default async function MeetingPage({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const m = await getMeeting(Number(id));
  if (!m) notFound();

  const now = new Date();
  const past = isPast(m, now);
  const closed = m.status === "closed";
  const rel = relativeDayLabel(m.startsAt, now);
  const wishes = await getWishContext();
  const loggedIn = Boolean(wishes.user);
  const hasRecord = past && wishes.user ? Boolean(await getRecord(wishes.user.id, m.id)) : false;
  const recordHref = `/me/records/${m.id}`;

  return (
    <article className="pt-2">
      <BackLink />

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <GenreTag genre={m.tagGenre} />
        <PlainTag>{m.tagFormat}</PlainTag>
        <PlainTag>{m.tagCadence}</PlainTag>
        {past ? <StatusBadge kind="past" /> : closed ? <StatusBadge kind="closed" /> : null}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <h1 className="font-display text-h2 text-ink">{m.title}</h1>
        {wishes.enabled && (
          <div className="-mr-2 mt-1">
            <WishButton kind="meeting" id={m.id} wished={wishes.meetingIds.has(m.id)} loggedIn={loggedIn} label={m.title} />
          </div>
        )}
      </div>
      {m.bookTitle && <p className="mt-2 text-b1 text-ink-2">『{m.bookTitle}』</p>}

      <dl className="mt-5 space-y-3 rounded-md border border-border-card bg-card p-4 text-b2 text-ink">
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-ink-3">일시</dt>
          <dd className="font-semibold text-ink">
            {formatKst(m.startsAt)}
            {rel && !past && <span className="ml-1.5 rounded-xs bg-info-surface px-1.5 py-0.5 text-l2 text-navy">{rel}</span>}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-ink-3">책방</dt>
          <dd className="flex flex-1 items-center justify-between gap-2">
            <span>
              {m.store.name} <span className="text-ink-3">· {m.store.region}</span>
            </span>
            {wishes.enabled && (
              <span className="-my-2 -mr-2 flex shrink-0 items-center">
                <span className="whitespace-nowrap text-l2 text-ink-3">책방 찜</span>
                <WishButton kind="store" id={m.store.id} wished={wishes.storeIds.has(m.store.id)} loggedIn={loggedIn} label={m.store.name} size="sm" />
              </span>
            )}
          </dd>
        </div>
        {m.place && (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-ink-3">장소</dt>
            <dd>{m.place}</dd>
          </div>
        )}
        {m.feeText && (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-ink-3">참가비</dt>
            <dd>{m.feeText}</dd>
          </div>
        )}
      </dl>

      {/* 신뢰 신호 */}
      <p className="mt-3 rounded-md bg-sub px-3 py-2.5 text-l2 font-normal leading-normal text-ink-2">
        부엉이서재가 <strong className="text-ink">{formatDateString(m.lastCheckedAt)}</strong>에 마지막으로 확인한 정보입니다.
        정확한 내용·마감 여부는 책방 신청 페이지를 기준으로 확인해 주시기 바랍니다.
      </p>

      <div className="mt-5 space-y-2">
        {past ? (
          <>
            <p className="rounded-sm bg-fill py-3.5 text-center text-l1 font-semibold text-ink-2">이미 지난 모임이에요</p>
            {wishes.enabled && (
              <Link
                href={loggedIn ? recordHref : `/login?next=${encodeURIComponent(recordHref)}`}
                className="block w-full rounded-sm bg-navy py-3.5 text-center text-t2 text-white hover:bg-navy-hover active:bg-navy-active"
              >
                {hasRecord ? "내 기록 보기" : "다녀왔어요 · 기록하기"}
              </Link>
            )}
            {wishes.enabled && !hasRecord && <p className="text-center text-l2 font-normal text-ink-3">🔒 기록은 나만 볼 수 있어요</p>}
          </>
        ) : closed ? (
          <p className="rounded-sm bg-fill py-3.5 text-center text-l1 font-semibold text-ink-2">신청이 마감된 모임이에요</p>
        ) : (
          <ApplyButton meetingId={m.id} storeName={m.store.name} />
        )}
        {m.postUrl && (
          <a href={`/go/${m.id}?to=post`} className="block w-full rounded-sm border border-border-strong bg-card py-3 text-center text-l1 font-semibold text-navy hover:bg-sub">
            책방 원 게시물 보기 ↗
          </a>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <ShareButton meetingId={m.id} storeId={m.store.id} title={m.title} />
        <ReportLink meetingId={m.id} storeId={m.store.id} title={m.title} />
      </div>
    </article>
  );
}
