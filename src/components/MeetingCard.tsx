import Image from "next/image";
import Link from "next/link";
import { getBookCover } from "@/lib/books";
import { isPast, seriesIndex, type Meeting } from "@/lib/meetings";
import { formatKstMonthDay, meetingTime } from "@/lib/time";
import { GenreTag, PlainTag, SeriesBadge, StatusBadge } from "@/components/Tag";
import { WishButton } from "@/components/WishButton";

// 찜 하트 표시용(로그인 기능이 꺼져 있으면 넘기지 않아 하트가 숨는다)
export type CardWish = { wished: boolean; loggedIn: boolean };

// hideStore: 책방 상세 화면처럼 이미 어느 책방인지 아는 곳에서는 책방 이름 줄을 뺀다
// href: 카드를 눌렀을 때 갈 곳(기본은 모임 상세). 운영자 승인 미리보기는 미리보기 화면으로 보낸다
export async function MeetingCard({ meeting: m, now, wish, hideStore, href }: { meeting: Meeting; now: Date; wish?: CardWish; hideStore?: boolean; href?: string }) {
  const past = isPast(m, now);
  const cover = await getBookCover(m.bookTitle);
  // 지난·마감 모임: 카드 전체를 흐리게 하면 글씨가 안 읽혀서, 표지와 시각만 낮추고 배지로 알린다
  const dim = past || m.status === "closed";
  // 여러 회차 묶음: 접힌 카드는 이 회차부터 끝 회차까지의 기간과 남은 책 권수를 함께 보여 준다
  const idx = seriesIndex(m);
  const sessions = m.series?.sessions ?? [];
  const rest = m.series?.collapsed && idx ? sessions.slice(idx - 1) : [];
  const otherBooks = new Set(rest.map((s) => s.bookTitle).filter((t) => t && t !== m.bookTitle)).size;
  // 마지막 확인일은 카드에 두지 않는다: 뜻이 낯설어서, 문장으로 풀어 쓴 상세 화면에서만 보여 준다(신청은 상세에서만 할 수 있어 누구나 한 번은 본다)
  // 카드 전체를 누르면 모임 상세로 간다: 제목 링크의 투명한 덮개(after)가 카드 전체를 덮는다.
  // 책방 이름 링크와 하트는 그 덮개 위(z-10)에 올려서 따로 누를 수 있다(링크 안에 링크·버튼을 넣을 수 없어서)
  return (
    <div className="relative flex gap-3.5 rounded-md border border-border-card bg-card p-4 transition hover:border-border-strong has-[a[data-card-link]:active]:scale-[0.99]">
      {/* 표지는 세로 가운데: 글이 길어져도 표지 아래만 비지 않게 위아래 여백을 고르게 */}
      <div className={`self-center ${dim ? "opacity-50 grayscale" : ""}`}>
        <BookCover url={cover?.url ?? null} title={m.bookTitle} />
      </div>
      <div className="min-w-0 flex-1">
        {/* 시각 바로 오른쪽에 묶음 → 마감(지난 모임) 순으로 배지를 붙인다. 폭이 모자라면 다음 줄로 넘긴다 */}
        <div className={`flex flex-wrap items-center gap-1.5 ${wish ? "pr-9" : ""}`}>
          <span className={`text-l1 font-semibold ${dim ? "text-ink-3" : "text-navy"}`}>{meetingTime(m)}</span>
          {idx && <SeriesBadge index={idx} total={sessions.length} collapsed={Boolean(m.series?.collapsed)} />}
          {past ? <StatusBadge kind="past" /> : m.status === "closed" ? <StatusBadge kind="closed" /> : null}
        </div>
        <h3 className="mt-1.5 text-t2 text-ink">
          <Link
            href={href ?? `/m/${m.id}`}
            data-card-link
            className="after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-navy"
          >
            {m.title}
          </Link>
        </h3>
        {rest.length > 1 && (
          <p className="mt-1 text-b2 text-ink-2">
            {formatKstMonthDay(rest[0].startsAt)} ~ {formatKstMonthDay(rest[rest.length - 1].startsAt)}, {rest.length}회
          </p>
        )}
        {m.bookTitle && (
          <p className="mt-1 text-b2 text-ink-2">
            『{m.bookTitle}』{otherBooks > 0 ? ` 외 ${otherBooks}권` : m.bookAuthor && ` ${m.bookAuthor}`}
          </p>
        )}
        {!hideStore && (
          <p className="mt-0.5 text-b2 text-ink-3">
            {/* 책방 이름을 누르면 책방 화면으로. 위아래로 누르는 영역을 넓혀 손가락으로도 누르기 쉽게 */}
            <Link
              href={`/s/${m.store.id}`}
              className="relative z-10 -my-1.5 inline-block py-1.5 underline decoration-border underline-offset-4 hover:text-navy hover:decoration-navy"
            >
              {m.store.name}
            </Link>{" "}
            · {m.store.region}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <GenreTag genre={m.tagGenre} />
          <PlainTag>{m.tagFormat}</PlainTag>
          <PlainTag>{m.tagCadence}</PlainTag>
        </div>
      </div>
      {wish && (
        <div className="absolute right-2 top-2 z-10">
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
  // 책이 없는 모임(보드게임·글쓰기 등): 같은 크기 칸에 부엉이만 가운데 둔다(목록 정렬 유지, 모임 이름은 바로 옆에 있음)
  if (!title) {
    return (
      <div aria-hidden className={`${box} flex items-center justify-center bg-[var(--illustration-cream)] ring-1 ring-border`}>
        <span className="text-2xl opacity-60">🦉</span>
      </div>
    );
  }
  // 표지 대신 책 페이지 느낌: 일러스트 전용 크림색 표면(글자는 ink 계열)
  return (
    <div aria-hidden className={`${box} flex flex-col justify-between bg-[var(--illustration-cream)] p-2 ring-1 ring-border`}>
      <span className="line-clamp-4 text-l2 font-semibold text-ink-2">{title}</span>
      <span className="self-end text-sm opacity-60">🦉</span>
    </div>
  );
}
