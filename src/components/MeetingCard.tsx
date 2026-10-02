import Image from "next/image";
import Link from "next/link";
import { getBookCover } from "@/lib/books";
import { isPast, type Meeting } from "@/lib/meetings";
import { formatDateString, formatKstTime } from "@/lib/time";
import { GenreTag, PlainTag, StatusBadge } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";

// 찜 하트 표시용(로그인 기능이 꺼져 있으면 넘기지 않아 하트가 숨는다)
export type CardWish = { wished: boolean; loggedIn: boolean };

export async function MeetingCard({ meeting: m, now, wish }: { meeting: Meeting; now: Date; wish?: CardWish }) {
  const past = isPast(m, now);
  const cover = await getBookCover(m.bookTitle);
  // 지난·마감 모임: 카드 전체를 흐리게 하면 글씨가 안 읽혀서, 표지와 시각만 낮추고 배지로 알린다
  const dim = past || m.status === "closed";
  // 하트는 링크 안에 넣을 수 없어(버튼 안의 버튼) 카드 위에 겹쳐 놓는다
  return (
    <div className="relative">
    <Link
      href={`/m/${m.id}`}
      className="flex gap-3.5 rounded-md border border-border-card bg-card p-4 transition hover:border-border-strong active:scale-[0.99]"
    >
      <div className={dim ? "opacity-50 grayscale" : ""}>
        <BookCover url={cover?.url ?? null} title={m.bookTitle} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center justify-between gap-2 ${wish ? "pr-9" : ""}`}>
          <span className={`text-l1 font-semibold ${dim ? "text-ink-3" : "text-navy"}`}>{formatKstTime(m.startsAt)}</span>
          {past ? <StatusBadge kind="past" /> : m.status === "closed" ? <StatusBadge kind="closed" /> : null}
        </div>
        <h3 className="mt-1.5 text-t2 text-ink">{m.title}</h3>
        {m.bookTitle && (
          <p className="mt-1 text-b2 text-ink-2">
            『{m.bookTitle}』{m.bookAuthor && <span className="text-ink-3"> · {m.bookAuthor}</span>}
          </p>
        )}
        <p className="mt-0.5 text-b2 text-ink-3">
          {m.store.name} · {m.store.region}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <GenreTag genre={m.tagGenre} />
          <PlainTag>{m.tagFormat}</PlainTag>
          <PlainTag>{m.tagCadence}</PlainTag>
          <span className="ml-auto text-l2 font-normal text-ink-3">확인 {formatDateString(m.lastCheckedAt)}</span>
        </div>
      </div>
    </Link>
    {wish && (
      <div className="absolute right-2 top-2">
        <WishButton kind="meeting" id={m.id} wished={wish.wished} loggedIn={wish.loggedIn} label={m.title} size="sm" />
      </div>
    )}
    </div>
  );
}

// 책 표지(2:3). 표지를 못 찾으면 같은 크기의 종이 질감 칸에 책 제목을 세로로 얹어 목록 정렬을 유지한다.
function BookCover({ url, title }: { url: string | null; title: string | null }) {
  const box = "relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-xs";
  if (url) {
    return (
      <div className={`${box} bg-fill shadow-[0_1px_3px_rgba(22,24,28,0.16)] ring-1 ring-border`}>
        <Image src={url} alt={title ? `『${title}』 표지` : "책 표지"} fill sizes="72px" unoptimized className="object-cover" />
      </div>
    );
  }
  // 표지 대신 책 페이지 느낌: 일러스트 전용 크림색 표면(글자는 ink 계열)
  return (
    <div aria-hidden className={`${box} flex flex-col justify-between bg-[var(--illustration-cream)] p-2 ring-1 ring-border`}>
      <span className="line-clamp-4 text-l2 font-semibold text-ink-2">{title ?? "함께 읽을 책"}</span>
      <span className="self-end text-sm opacity-60">🦉</span>
    </div>
  );
}
