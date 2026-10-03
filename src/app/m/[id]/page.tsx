import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyButton } from "@/components/ApplyButton";
import { BackLink } from "@/components/BackLink";
import { ReportLink } from "@/components/ReportLink";
import { ShareButton } from "@/components/ShareButton";
import { StickyActionBar } from "@/components/StickyActionBar";
import { MoreText } from "@/components/MoreText";
import { PlanMark } from "@/components/PlanMark";
import { RichText } from "@/components/RichText";
import { GenreTag, PlainTag, StatusBadge } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";
import { getPlan, getRecord, getWishContext } from "@/lib/me";
import { getMeeting, isPast } from "@/lib/meetings";
import { estimateLines, plainSummary } from "@/lib/rich-text";
import { formatDateString, formatKst, relativeDayLabel } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = await getMeeting(Number(id));
  if (!m) return { title: "모임을 찾을 수 없어요" };
  // 공유 미리보기 설명: 모임 소개가 있으면 앞부분을 맨 앞에 둔다
  const description = `${m.description ? `${plainSummary(m.description)} · ` : ""}${formatKst(m.startsAt)} · ${m.store.name}(${m.store.region})${m.bookTitle ? ` · 『${m.bookTitle}』${m.bookAuthor ? ` ${m.bookAuthor}` : ""}` : ""}`;
  return {
    title: `${m.title} | ${m.store.name}`,
    description,
    openGraph: { title: `${m.title} | ${m.store.name}`, description },
    alternates: { canonical: `/m/${m.id}` },
  };
}

export default async function MeetingPage({ params, searchParams }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMeeting(Number(id));
  if (!m) notFound();

  const now = new Date();
  const past = isPast(m, now);
  const closed = m.status === "closed";
  const rel = relativeDayLabel(m.startsAt, now);
  const wishes = await getWishContext();
  const loggedIn = Boolean(wishes.user);
  const hasRecord = past && wishes.user ? Boolean(await getRecord(wishes.user.id, m.id)) : false;
  // 내 모임(책방에서 신청했다고 표시했는지). 다가오는 모임에서만 쓴다
  const plan = !past && wishes.user ? await getPlan(wishes.user.id, m.id) : null;
  const recordHref = `/me/records/${m.id}`;

  return (
    <article className="pt-2">
      {sp.planned === "1" && plan?.appliedAt && (
        <p role="status" className="mb-3 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          내 모임에 담았어요. 마이페이지 ‘내 모임’에서 날짜순으로 볼 수 있어요.
        </p>
      )}
      {/* 맨 위 줄: 왼쪽 '모임 목록', 오른쪽 '공유' */}
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <ShareButton meetingId={m.id} storeId={m.store.id} title={m.title} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <GenreTag genre={m.tagGenre} />
        <PlainTag>{m.tagFormat}</PlainTag>
        <PlainTag>{m.tagCadence}</PlainTag>
        {past ? <StatusBadge kind="past" /> : closed ? <StatusBadge kind="closed" /> : null}
      </div>

      {/* 모임 찜은 아래 고정 띠에 있다 */}
      <h1 className="mt-3 font-display text-h2 text-ink">{m.title}</h1>
      {m.bookTitle && (
        <p className="mt-2 text-b1 text-ink-2">
          『{m.bookTitle}』{m.bookAuthor && ` ${m.bookAuthor}`}
        </p>
      )}

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
        {/* 장소·참가비는 비어 있어도 줄을 보여 준다: 신청 전에 가장 많이 확인하는 정보라 '없음'과 '모름'을 구분해 알려 준다 */}
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-ink-3">장소</dt>
          <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
            {m.store.address || m.place ? (
              <span className="min-w-0 break-keep">
                {m.store.address && <span className="block">{m.store.address}</span>}
                {m.place && <span className={m.store.address ? "mt-0.5 block text-ink-2" : "block"}>{m.place}</span>}
              </span>
            ) : (
              <span className="text-ink-3">책방 신청 페이지에서 확인해 주세요</span>
            )}
            {m.store.address && (
              <a
                href={`https://map.naver.com/p/search/${encodeURIComponent(m.store.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${m.store.name} 위치를 네이버 지도에서 보기`}
                className="-my-3 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-l2 text-navy underline underline-offset-2 hover:text-navy-hover"
              >
                <PinIcon />
                지도
              </a>
            )}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-ink-3">참가비</dt>
          <dd className={m.feeText ? "font-semibold text-ink" : "text-ink-3"}>{m.feeText ?? "책방 신청 페이지에서 확인해 주세요"}</dd>
        </div>
      </dl>

      {m.description && (
        <section aria-labelledby="meeting-description" className="mt-6">
          <h2 id="meeting-description" className="text-t2 text-ink">
            모임 소개
          </h2>
          <div className="mt-2">
            {/* 접힌 상태는 6줄 남짓 보인다. 펼쳐서 3줄 이상 더 나올 때만 접는다(조금 가리려고 '더 보기'를 누르게 하지 않게) */}
            <MoreText long={estimateLines(m.description) >= 10}>
              <RichText text={m.description} className="text-b1 text-ink-2" />
            </MoreText>
          </div>
        </section>
      )}

      {/* 신뢰 신호 */}
      <p className="mt-3 rounded-md bg-sub px-3 py-2.5 text-l2 font-normal leading-normal text-ink-2">
        부엉이서재가 <strong className="text-ink">{formatDateString(m.lastCheckedAt)}</strong>에 마지막으로 확인한 정보입니다.
        정확한 내용·마감 여부는 책방 신청 페이지를 기준으로 확인해 주시기 바랍니다.
      </p>

      {!past && wishes.enabled && <PlanMark meetingId={m.id} storeName={m.store.name} loggedIn={loggedIn} applied={Boolean(plan?.appliedAt)} />}

      {m.postUrl && (
        <a href={`/go/${m.id}?to=post`} className="mt-5 flex w-full flex-col items-center rounded-sm border border-border-strong bg-card px-3 py-3 text-center hover:bg-sub">
          <span className="text-l1 font-semibold text-navy">책방이 올린 모임 글 보기 ↗</span>
          <span className="mt-0.5 text-l2 font-normal text-ink-2">정확한 내용은 책방 {postPlace(m.postUrl)}에서 확인해 주세요</span>
        </a>
      )}

      <div className={`${m.postUrl ? "mt-2" : "mt-4"} flex justify-center`}>
        <ReportLink meetingId={m.id} storeId={m.store.id} title={m.title} />
      </div>

      {/* 신청(또는 기록) 버튼은 스크롤과 상관없이 화면 아래에 붙어 있다. 앰버 버튼은 이 한 번만 쓴다 */}
      <StickyActionBar>
        {wishes.enabled && <WishButton kind="meeting" id={m.id} wished={wishes.meetingIds.has(m.id)} loggedIn={loggedIn} label={m.title} size="bar" />}
        {past ? (
          wishes.enabled ? (
            <Link
              href={loggedIn ? recordHref : `/login?next=${encodeURIComponent(recordHref)}`}
              aria-describedby={hasRecord ? undefined : "record-private"}
              className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-sm bg-navy px-3 text-center text-white hover:bg-navy-hover active:bg-navy-active"
            >
              <span className="text-t2">{hasRecord ? "내 기록 보기" : "다녀왔어요 · 기록하기"}</span>
              {!hasRecord && (
                <span id="record-private" className="text-l2 font-normal text-dk-ink-2">
                  기록은 나만 볼 수 있어요
                </span>
              )}
            </Link>
          ) : (
            <p className="flex min-h-12 flex-1 items-center justify-center rounded-sm bg-fill text-l1 font-semibold text-ink-2">이미 지난 모임이에요</p>
          )
        ) : closed ? (
          <p className="flex min-h-12 flex-1 items-center justify-center rounded-sm bg-fill text-l1 font-semibold text-ink-2">신청이 마감된 모임이에요</p>
        ) : (
          <ApplyButton meetingId={m.id} storeName={m.store.name} canSave={wishes.enabled} />
        )}
      </StickyActionBar>
    </article>
  );
}

// 원 게시물 링크 주소를 보고 '어디로 가는지'를 쉬운 말로 알려 준다. 모르는 주소는 '페이지'로 둔다
function postPlace(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^(www|m)\./, "");
  } catch {
    return "페이지";
  }
  if (host === "instagram.com") return "인스타그램";
  if (host === "threads.net" || host === "threads.com") return "스레드";
  if (host === "blog.naver.com") return "블로그";
  if (host === "cafe.naver.com") return "카페";
  return "페이지";
}

function PinIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx={12} cy={9.5} r={2.5} />
    </svg>
  );
}
