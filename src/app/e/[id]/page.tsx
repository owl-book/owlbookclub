import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { DisplayText } from "@/components/DisplayText";
import { PaidBadge } from "@/components/ExhibitionCard";
import { PinIcon } from "@/components/PinIcon";
import { RichText } from "@/components/RichText";
import { PlainTag } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";
import { KIND_LABEL, exhibitionPhase, getExhibition, todayKey, type Exhibition } from "@/lib/exhibitions";
import { getWishContext } from "@/lib/me";
import { getStore } from "@/lib/stores";
import { formatDateStringWithDay } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/e/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await getExhibition(Number(id));
  if (!e) return { title: "전시를 찾을 수 없어요" };
  const description = `${e.store.name}(${e.store.region}) ${KIND_LABEL[e.kind]} · ${formatDateStringWithDay(e.startsOn)} ~ ${formatDateStringWithDay(e.endsOn)}`;
  return {
    title: e.title,
    description,
    openGraph: { title: `${e.title} | 부엉이들의 서재`, description, images: e.poster ? [e.poster.url] : undefined },
    alternates: { canonical: `/e/${e.id}` },
  };
}

// 전시 글: 포스터 → 이름·작가·찜 → 기간·시간·(유료면)입장료 → 찾아가는 정보(책방·위치·운영시간) → 소개 → 원문.
// 작품 사진은 싣지 않는다: 작품은 책방에 가서 보는 것이라, 이 화면의 일은 '언제·어디로 가면 되는지'를 알려 주는 것이다.
// 앰버 버튼도 쓰지 않는다: 신청처럼 되돌리기 어려운 행동이 없고, 원문은 참고용 글자 링크로 둔다.
export default async function ExhibitionPage({ params }: PageProps<"/e/[id]">) {
  const { id } = await params;
  const e = await getExhibition(Number(id));
  if (!e) notFound();

  const now = new Date();
  const [store, wishes] = await Promise.all([getStore(e.store.id), getWishContext()]);
  const phase = exhibitionPhase(e, now);

  return (
    <article className="pt-2">
      <BackLink label="뒤로" />

      {e.poster && <PosterLarge exhibition={e} dim={phase === "past"} />}

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <PlainTag>{KIND_LABEL[e.kind]}</PlainTag>
          {phase === "past" && <span className="rounded-xs bg-fill px-1.5 py-0.5 text-l2 font-semibold text-ink-3">지난 전시</span>}
        </div>
        <h1 className="mt-2 font-display text-h2 text-ink">
          <DisplayText>{e.title}</DisplayText>
        </h1>
        {e.artist && <p className="mt-1.5 text-b1 text-ink-2">{e.artist}</p>}
        {wishes.enabled && (
          <div className="mt-4">
            <span className="inline-flex min-h-11 items-center rounded-sm border border-border-card bg-card pl-3 pr-1">
              <span className="text-l1 text-ink-2">전시 찜</span>
              <WishButton kind="exhibition" id={e.id} wished={wishes.exhibitionIds.has(e.id)} loggedIn={Boolean(wishes.user)} label={e.title} size="sm" />
            </span>
          </div>
        )}
      </header>

      <div className="mt-5 rounded-md border border-border-card bg-card p-4">
        <dl className="space-y-3 text-b2 text-ink">
          <Row label="기간">
            <span className="break-keep">{periodText(e)}</span>
            <PhaseHint exhibition={e} now={now} />
          </Row>
          <Row label="시간">
            {e.hoursNote ? (
              <span className="whitespace-pre-line break-keep">{e.hoursNote}</span>
            ) : store?.hours ? (
              <>
                <span className="block text-ink-2">책방 운영시간에 볼 수 있어요</span>
                <span className="mt-1 block whitespace-pre-line break-keep">{store.hours}</span>
              </>
            ) : (
              <span className="text-ink-2">책방 운영시간에 볼 수 있어요</span>
            )}
          </Row>
          {/* 대부분 무료라 평소엔 줄을 빼고, 유료일 때만 보여 준다 */}
          {e.isPaid && (
            <Row label="입장료">
              <PaidBadge fee={e.feeNote} />
            </Row>
          )}
          <Row label="장소">
            <Link href={`/s/${e.store.id}`} className="-my-1.5 inline-block py-1.5 font-semibold underline decoration-border-strong underline-offset-4 hover:text-navy">
              {e.store.name}
            </Link>
            {store?.address ? (
              <span className="mt-0.5 flex items-start justify-between gap-2">
                <span className="min-w-0 break-keep text-ink-2">{store.address}</span>
                <a
                  href={`https://map.naver.com/p/search/${encodeURIComponent(store.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${e.store.name} 위치를 네이버 지도에서 보기`}
                  className={EXTERNAL_LINK}
                >
                  <PinIcon />
                  지도
                </a>
              </span>
            ) : (
              <span className="mt-0.5 block text-ink-2">{e.store.region}</span>
            )}
          </Row>
        </dl>
        {!e.hoursNote && store?.hours && (
          <p className="mt-4 border-t border-border-card pt-3 text-l2 font-normal text-ink-3">
            운영시간은 네이버 플레이스 정보를 기준으로 했어요. 휴무나 시간이 바뀔 수 있으니 가기 전에 한 번 더 확인해 주세요.
          </p>
        )}
      </div>

      {e.intro && (
        <section aria-labelledby="ex-intro" className="mt-8">
          <h2 id="ex-intro" className="text-t2 text-ink">
            전시 소개
          </h2>
          <RichText text={e.intro} className="mt-2 text-b1 text-ink-2" />
        </section>
      )}

      {e.postUrl && (
        <p className="mt-6">
          <a
            href={e.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-3 inline-flex min-h-11 items-center text-b2 text-navy underline underline-offset-2 hover:text-navy-hover"
          >
            책방 게시물 원문 보기 ↗
          </a>
        </p>
      )}

      {/* 전시를 보러 간 김에 같은 책방의 독서모임도 */}
      <Link
        href={`/s/${e.store.id}`}
        className="mt-8 flex min-h-11 items-center justify-between rounded-md border border-border-card bg-card px-4 py-3 text-b2 text-ink hover:border-border-strong"
      >
        {e.store.name}의 독서모임도 보기
        <span aria-hidden className="text-ink-3">→</span>
      </Link>

      <div className="mt-8 space-y-1 text-l2 font-normal text-ink-3">
        <p>전시 내용과 일정은 책방 공지가 기준이에요.</p>
        <p>
          다른 점이 있으면{" "}
          <Link href={`/contact?store=${e.store.id}`} className="-my-3 inline-flex min-h-11 items-center text-navy underline underline-offset-2 hover:text-navy-hover">
            알려주기
          </Link>
        </p>
      </div>
    </article>
  );
}

const EXTERNAL_LINK =
  "-my-3 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-l2 text-navy underline underline-offset-2 hover:text-navy-hover";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function periodText(e: Pick<Exhibition, "startsOn" | "endsOn">): string {
  return e.startsOn === e.endsOn ? formatDateStringWithDay(e.startsOn) : `${formatDateStringWithDay(e.startsOn)} ~ ${formatDateStringWithDay(e.endsOn)}`;
}

// 기간 아래 한 줄: 지금 하는 전시는 며칠 남았는지(곧 끝나면 서두르도록), 곧 열리는 전시는 며칠 뒤 시작하는지
function PhaseHint({ exhibition: e, now }: { exhibition: Exhibition; now: Date }) {
  const phase = exhibitionPhase(e, now);
  if (phase === "past") return null;
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const today = todayKey(now);
  const text =
    phase === "now"
      ? days(today, e.endsOn) === 0
        ? "오늘이 마지막 날이에요"
        : `지금 하고 있어요 · ${days(today, e.endsOn)}일 남았어요`
      : days(today, e.startsOn) === 1
        ? "내일 시작해요"
        : `${days(today, e.startsOn)}일 뒤에 시작해요`;
  return <span className="mt-1 block text-l1 font-semibold text-navy">{text}</span>;
}

// 포스터는 원래 비율 그대로(잘라 내면 글자가 잘린다). 비율을 알면 자리를 미리 잡아 화면이 덜컹이지 않게 한다
function PosterLarge({ exhibition: e, dim }: { exhibition: Exhibition; dim: boolean }) {
  const poster = e.poster!;
  const ratio = poster.width && poster.height ? poster.width / poster.height : 3 / 4;
  return (
    <div className={`mt-2 flex justify-center rounded-lg bg-fill p-4 ${dim ? "opacity-60 grayscale" : ""}`}>
      <div className="relative w-full max-w-[22rem] overflow-hidden rounded-xs shadow-[0_2px_8px_rgba(22,24,28,0.18)]" style={{ aspectRatio: ratio }}>
        <Image src={poster.url} alt={`${e.title} 포스터`} fill priority sizes="(max-width: 640px) 100vw, 352px" unoptimized className="object-contain" />
      </div>
    </div>
  );
}
