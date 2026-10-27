import Image from "next/image";
import Link from "next/link";
import { PlainTag } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";
import type { CardWish } from "@/components/MeetingCard";
import type { WishContext } from "@/lib/me";
import { KIND_LABEL, exhibitionPhase, type Exhibition, type ExhibitionKind } from "@/lib/exhibitions";
import { dayKey, formatDateString, kstDayNumber } from "@/lib/time";

// 전시 카드: 왼쪽 세로 포스터 + 오른쪽 기간·이름·작가·책방.
// 독자가 할 일은 '언제까지 가면 되나'를 보는 것이라, 기간을 맨 위에 남색으로 둔다(모임 카드의 시각 자리와 같다).
// 카드 전체를 누르면 전시 글로, 책방 이름과 하트는 덮개 위(z-10)에서 따로 누를 수 있다(MeetingCard 와 같은 구조).
export function ExhibitionCard({ exhibition: e, now, wish, hideStore, href }: { exhibition: Exhibition; now: Date; wish?: CardWish; hideStore?: boolean; href?: string }) {
  const past = exhibitionPhase(e, now) === "past";
  return (
    <div className="relative flex gap-3.5 rounded-md border border-border-card bg-card p-4 transition hover:border-border-strong has-[a[data-card-link]:active]:scale-[0.99]">
      <div className={`self-start ${past ? "opacity-50 grayscale" : ""}`}>
        <PosterThumb exhibition={e} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-1.5 ${wish ? "pr-9" : ""}`}>
          <span className={`text-l1 font-semibold ${past ? "text-ink-3" : "text-navy"}`}>{exhibitionWhenShort(e, now)}</span>
          {e.isPaid && <PaidBadge />}
        </div>
        <h3 className="mt-1.5 text-t2 text-ink">
          <Link
            href={href ?? `/e/${e.id}`}
            data-card-link
            className="after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-navy"
          >
            {e.title}
          </Link>
        </h3>
        {e.artist && <p className="mt-1 text-b2 text-ink-2">{e.artist}</p>}
        {!hideStore && (
          <p className="mt-0.5 text-b2 text-ink-3">
            <Link
              href={`/s/${e.store.id}`}
              className="relative z-10 -my-1.5 inline-block py-1.5 underline decoration-border underline-offset-4 hover:text-navy hover:decoration-navy"
            >
              {e.store.name}
            </Link>{" "}
            · {e.store.region}
          </p>
        )}
        {/* 포스터가 없으면 빈 포스터 칸에 이미 종류가 적혀 있어서 꼬리표는 뺀다 */}
        {e.poster && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <PlainTag>{KIND_LABEL[e.kind]}</PlainTag>
          </div>
        )}
      </div>
      {wish && (
        <div className="absolute right-2 top-2 z-10">
          <WishButton kind="exhibition" id={e.id} wished={wish.wished} loggedIn={wish.loggedIn} label={e.title} size="sm" />
        </div>
      )}
    </div>
  );
}

// 전시 카드 목록(전시 모아보기·책방 화면·마이페이지 공통). 로그인 기능이 꺼져 있으면 하트를 숨긴다
export function ExhibitionList({ list, now, wishes, className, hideStore }: { list: Exhibition[]; now: Date; wishes: WishContext; className?: string; hideStore?: boolean }) {
  const loggedIn = Boolean(wishes.user);
  return (
    <ul className={`space-y-3 ${className ?? ""}`}>
      {list.map((e) => (
        <li key={e.id}>
          <ExhibitionCard
            exhibition={e}
            now={now}
            hideStore={hideStore}
            wish={wishes.enabled ? { wished: wishes.exhibitionIds.has(e.id), loggedIn } : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

// 대부분 무료라 평소엔 아무것도 붙이지 않고, 유료일 때만 알린다(가서야 돈이 드는 걸 알면 실망하니 목록에서도 미리)
export function PaidBadge({ fee }: { fee?: string | null }) {
  return (
    <span className="whitespace-nowrap rounded-xs border border-warning-border bg-warning-surface px-1.5 py-0.5 text-l2 font-semibold text-warning">
      유료{fee ? ` ${fee}` : ""}
    </span>
  );
}

// 카드용 짧은 기간: 지금 하는 전시는 '언제까지', 곧 열리는 전시는 '언제부터', 지난 전시는 기간 전체
export function exhibitionWhenShort(e: Pick<Exhibition, "startsOn" | "endsOn">, now: Date): string {
  const phase = exhibitionPhase(e, now);
  const today = kstDayNumber(now);
  const near = (s: string) => (s === dayKey(today) ? "오늘" : s === dayKey(today + 1) ? "내일" : formatDateString(s));
  if (phase === "now") return `${near(e.endsOn)}까지`;
  if (phase === "soon") return `${near(e.startsOn)}부터`;
  return e.startsOn === e.endsOn ? formatDateString(e.startsOn) : `${formatDateString(e.startsOn)} ~ ${formatDateString(e.endsOn)}`;
}

// 목록용 포스터(3:4). 포스터가 없으면 같은 크기의 종이 칸에 전시 종류를 얹어 목록 줄을 맞춘다
function PosterThumb({ exhibition: e }: { exhibition: Exhibition }) {
  const box = "relative h-[128px] w-[96px] shrink-0 overflow-hidden rounded-xs";
  if (e.poster) {
    return (
      <div className={`${box} bg-fill ring-1 ring-border`}>
        <Image src={e.poster.url} alt={`${e.title} 포스터`} fill sizes="96px" unoptimized className="object-cover" />
      </div>
    );
  }
  return <PosterPlaceholder kind={e.kind} className={box} />;
}

export function PosterPlaceholder({ kind, className }: { kind: ExhibitionKind; className: string }) {
  return (
    <div aria-hidden className={`${className} flex flex-col justify-between bg-[var(--illustration-cream)] p-2.5 ring-1 ring-border`}>
      <span className="text-l2 font-semibold text-ink-2">{KIND_LABEL[kind]}</span>
      <span className="self-end text-sm opacity-60">🦉</span>
    </div>
  );
}
