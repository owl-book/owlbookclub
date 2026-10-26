import Link from "next/link";
import { ApplyButton } from "@/components/ApplyButton";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";
import { BackLink } from "@/components/BackLink";
import { ReportSheet } from "@/components/ReportSheet";
import { ShareButton } from "@/components/ShareButton";
import { StickyActionBar } from "@/components/StickyActionBar";
import { MoreText } from "@/components/MoreText";
import { PinIcon } from "@/components/PinIcon";
import { PlanMark } from "@/components/PlanMark";
import { RichText } from "@/components/RichText";
import { SeriesSchedule } from "@/components/SeriesSchedule";
import { GenreTag, PlainTag, SeriesBadge, StatusBadge } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";
import { applyLabel, smsNumber } from "@/lib/apply";
import type { MeetingRecord, PlanState, WishContext } from "@/lib/me";
import { isPast, seriesIndex, type Meeting } from "@/lib/meetings";
import { estimateLines } from "@/lib/rich-text";
import { formatDateString, meetingWhen, relativeDayLabel } from "@/lib/time";

// 모임 상세 본문. 공개 화면(/m/[id])과 운영자 승인 미리보기(/admin/review/[id])가 함께 쓴다.
// preview 가 있으면: 찜·신고·공유를 빼고, 신청·게시물 버튼은 책방 주소를 새 창으로 바로 연다(숨긴 모임은 /go 로 보낼 수 없어서)
export function MeetingDetail({
  m,
  now,
  wishes,
  record = null,
  plan = null,
  plannedNotice = false,
  preview,
}: {
  m: Meeting;
  now: Date;
  wishes: WishContext;
  record?: MeetingRecord | null;
  plan?: PlanState | null;
  plannedNotice?: boolean;
  preview?: { backHref: string };
}) {
  const past = isPast(m, now);
  const closed = m.status === "closed";
  const rel = relativeDayLabel(m.startsAt, now);
  const loggedIn = Boolean(wishes.user);
  const hasRecord = Boolean(record);
  const recordHref = `/me/records/${m.id}`;
  // 여러 회차를 한 번에 신청하는 묶음 모임: 전체 회차 수와, 신청 표시하면 함께 담기는 남은 회차 수
  const idx = seriesIndex(m);
  const seriesTotal = m.series?.sessions.length ?? 0;
  const seriesLeft = m.series?.sessions.filter((x) => x.startsAt.getTime() >= now.getTime()).length ?? 0;

  return (
    <article className="pt-2">
      {preview && (
        <p role="status" className="mb-3 rounded-xs border border-border-strong bg-sub px-3 py-2.5 text-b2 text-ink-2">
          <strong className="text-ink">미리보기</strong> · 아직 공개 전이에요. 승인하면 손님에게 이 모습으로 보여요.
        </p>
      )}
      {plannedNotice && plan?.appliedAt && (
        <p role="status" className="mb-3 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          내 모임에 담았어요. 마이페이지 ‘내 모임’에서 날짜순으로 볼 수 있어요.
        </p>
      )}
      {/* 맨 위 줄: 왼쪽 '모임 목록', 오른쪽 '공유' */}
      <div className="flex items-center justify-between gap-2">
        {preview ? (
          <Link href={preview.backHref} className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
            <ArrowLeftIcon />
            승인 대기
          </Link>
        ) : (
          <>
            <BackLink />
            <ShareButton meetingId={m.id} storeId={m.store.id} title={m.title} />
          </>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <GenreTag genre={m.tagGenre} />
        <PlainTag>{m.tagFormat}</PlainTag>
        <PlainTag>{m.tagCadence}</PlainTag>
        {idx && <SeriesBadge index={idx} total={seriesTotal} collapsed={false} />}
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
            {meetingWhen(m)}
            {rel && !past && <span className="ml-1.5 rounded-xs bg-info-surface px-1.5 py-0.5 text-l2 text-navy">{rel}</span>}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-ink-3">책방</dt>
          <dd className="flex flex-1 items-center justify-between gap-2">
            {/* 책방 이름을 누르면 책방 화면(소개·이 책방의 다른 모임)으로 간다 */}
            <Link href={`/s/${m.store.id}`} className="-my-2 inline-flex min-h-11 items-center py-2 hover:text-navy">
              <span>
                <span className="underline decoration-border-strong underline-offset-4">{m.store.name}</span>{" "}
                <span className="text-ink-3">· {m.store.region}</span>
              </span>
            </Link>
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
        {/* 묶음 모임: 신청 버튼을 누르기 전에 꼭 알아야 해서 회차 일정(아래)과 따로 정보 칸에 둔다 */}
        {m.series && (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-ink-3">신청</dt>
            <dd>
              <span className="block font-semibold text-ink">{seriesTotal}회 한 번에 신청</span>
              <span className="mt-0.5 block text-ink-2">한 회만 골라 신청할 수는 없어요</span>
            </dd>
          </div>
        )}
      </dl>

      {/* 소개가 없는 묶음 모임은 회차 일정만 따로 보여 준다 */}
      {m.series && !m.description && <SeriesSchedule current={m.id} sessions={m.series.sessions} now={now} />}

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
          {/* 회차 일정은 소개의 일부로 바로 아래에 붙인다. 접히는 부분 밖이라 '더 보기'를 누르지 않아도 보인다 */}
          {m.series && <SeriesSchedule current={m.id} sessions={m.series.sessions} now={now} nested />}
        </section>
      )}

      {/* 신뢰 신호 */}
      {/* 신뢰 신호 + 정보 오류·마감 알려주기: '언제 확인한 정보인지' 바로 옆에서 '다른 점이 있는지' 묻는다(지난 모임은 받지 않음) */}
      <div className="mt-3 rounded-md bg-sub px-3 py-2.5 text-l2 font-normal leading-normal text-ink-2">
        <p>
          {formatDateString(m.lastCheckedAt)}에 마지막으로 업데이트 했어요.
          정확한 내용·마감 여부는 책방 공지를 확인해 주세요.
        </p>
        {!past && !preview && <ReportSheet meetingId={m.id} storeId={m.store.id} closed={closed} />}
      </div>

      {!past && wishes.enabled && m.applyMethod !== "none" && <PlanMark meetingId={m.id} storeName={m.store.name} loggedIn={loggedIn} applied={Boolean(plan?.appliedAt)} seriesLeft={seriesLeft} />}

      {m.postUrl && (
        <a href={preview ? m.postUrl : `/go/${m.id}?to=post`} target={preview ? "_blank" : undefined} rel={preview ? "noopener noreferrer" : undefined} className="mt-5 flex w-full flex-col items-center rounded-sm border border-border-strong bg-card px-3 py-3 text-center hover:bg-sub">
          <span className="text-l1 font-semibold text-navy">책방이 올린 모임 글 보기 ↗</span>
          <span className="mt-0.5 text-l2 font-normal text-ink-2">정확한 내용은 책방 {postPlace(m.postUrl)}에서 확인해 주세요</span>
        </a>
      )}

      {/* 신청(또는 기록) 버튼은 스크롤과 상관없이 화면 아래에 붙어 있다. 앰버 버튼은 이 한 번만 쓴다 */}
      <StickyActionBar>
        {wishes.enabled && <WishButton kind="meeting" id={m.id} wished={wishes.meetingIds.has(m.id)} loggedIn={loggedIn} label={m.title} size="bar" />}
        {past ? (
          wishes.enabled ? (
            <Link
              href={loggedIn ? recordHref : `/login?next=${encodeURIComponent(recordHref)}`}
              aria-describedby={hasRecord ? undefined : "record-private"}
              className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-sm bg-navy px-3 text-center text-page hover:bg-navy-hover active:bg-navy-active"
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
        ) : m.applyMethod === "none" ? (
          // 신청 없이 자유 방문하는 행사(플리마켓 등): 신청 버튼 대신 안내만
          <div className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-sm bg-fill px-3 py-1.5 text-center">
            <p className="text-l1 font-semibold text-ink">신청 없이 자유롭게 오시면 돼요</p>
            {m.postUrl && (
              <a href={preview ? m.postUrl : `/go/${m.id}?to=post`} target={preview ? "_blank" : undefined} rel={preview ? "noopener noreferrer" : undefined} className="mt-0.5 text-l2 font-normal text-navy underline underline-offset-2">
                자세한 내용은 {postPlace(m.postUrl)} 게시물에서 보기 ↗
              </a>
            )}
          </div>
        ) : preview ? (
          // 미리보기: 숨긴 모임은 /go 로 보낼 수 없어서, 책방 신청 주소를 새 창으로 바로 연다(주소가 맞는지 확인용)
          <a
            href={m.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 flex-1 items-center justify-center rounded-sm border border-amber-edge bg-amber px-3 text-center text-t2 text-amber-ink hover:bg-amber-hover"
          >
            {applyLabel(m.applyMethod, m.applyUrl)}
          </a>
        ) : (
          <ApplyButton meetingId={m.id} storeName={m.store.name} canSave={wishes.enabled} seriesTotal={seriesTotal} dm={m.applyMethod === "dm"} sms={smsNumber(m.applyUrl)} />
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
