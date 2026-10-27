import Image from "next/image";
import Link from "next/link";
import { getBookCover } from "@/lib/books";
import { isPast, seriesIndex, type Meeting } from "@/lib/meetings";
import { formatKstMonthDay, meetingTime } from "@/lib/time";
import { count, dateRange, hashTags, joinDot } from "@/lib/format";
import { MeetingStatusBadge, SeriesBadge } from "@/components/Tag";
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
  // 상태는 하나만: 지난 모임 > 신청마감 > 진행 중(묶음 모임의 앞 회차가 이미 지났을 때)
  const ongoing = sessions.some((s) => s.startsAt.getTime() < now.getTime());
  const statusKind = past ? "past" : m.status === "closed" ? "closed" : ongoing ? "ongoing" : null;
  const rest = m.series?.collapsed && idx ? sessions.slice(idx - 1) : [];
  const otherBooks = new Set(rest.map((s) => s.bookTitle).filter((t) => t && t !== m.bookTitle)).size;
  // 마지막 확인일은 카드에 두지 않는다: 뜻이 낯설어서, 문장으로 풀어 쓴 상세 화면에서만 보여 준다(신청은 상세에서만 할 수 있어 누구나 한 번은 본다)
  // 카드 전체를 누르면 모임 상세로 간다: 제목 링크의 투명한 덮개(after)가 카드 전체를 덮는다.
  // 책방 이름 링크와 하트는 그 덮개 위(z-10)에 올려서 따로 누를 수 있다(링크 안에 링크·버튼을 넣을 수 없어서)
  return (
    // 테두리 상자 없이 목록 한 줄로(모임 사이 선은 MeetingList 가 긋는다). 마우스를 올리면 옅은 바탕이 깔린다
    <div className="relative -mx-2 flex gap-3.5 rounded-md px-2 py-4 transition hover:bg-sub has-[a[data-card-link]:active]:bg-fill">
      {/* 표지는 세로 가운데: 글이 길어져도 표지 아래만 비지 않게 위아래 여백을 고르게.
          상태 뱃지는 표지 왼쪽 위에 얹는다(표지만 흐리게 하고 뱃지 글자는 그대로 읽히게) */}
      <div className="relative self-center">
        <div className={dim ? "opacity-50 grayscale" : ""}>
          <BookCover url={cover?.url ?? null} title={m.bookTitle} art={meetingArt(m)} />
        </div>
        {statusKind && <MeetingStatusBadge kind={statusKind} className="absolute left-1 top-1" />}
      </div>
      <div className="min-w-0 flex-1">
        {/* 시간은 날짜 제목(16px)보다 작고 조용하게: 날짜 → 모임 이름 → 시간 순으로 눈이 가도록 */}
        <div className={`flex flex-wrap items-center gap-1.5 ${wish ? "pr-9" : ""}`}>
          <span className={`fig text-l1 ${dim ? "text-ink-3" : "text-ink-2"}`}>{meetingTime(m)}</span>
        </div>
        <h3 className="mt-1.5 text-t2 text-ink">
          <Link
            href={href ?? `/m/${m.id}`}
            data-card-link
            className="after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-navy"
          >
            {m.title}
          </Link>
          {/* 묶음 모임은 제목이 끝나는 곳 바로 오른쪽에 '총 N회'. 한 줄에 안 들어가면 뱃지만 다음 줄로 내려간다(제목은 나뉘지 않음).
              앞의 빈칸은 화면 읽기 프로그램이 제목과 붙여 읽지 않게 하는 것(눈에 보이는 간격은 빈칸 + ml-0.5).
              뱃지 위쪽을 제목 글자 위쪽에 맞추면(align-text-top) 높이가 같아(둘 다 20px) 가운데가 맞는다 */}
          {idx && (
            <>
              {" "}
              <SeriesBadge total={sessions.length} className="ml-0.5 align-text-top" />
            </>
          )}
        </h3>
        {rest.length > 1 && (
          <p className="mt-1 text-b2 text-ink-2">
            {joinDot(dateRange(formatKstMonthDay(rest[0].startsAt), formatKstMonthDay(rest[rest.length - 1].startsAt)), count(rest.length, "회"))}
          </p>
        )}
        {m.bookTitle && (
          <p className="mt-1 text-b2 text-ink-2">
            『{m.bookTitle}』{otherBooks > 0 ? ` 외 ${count(otherBooks, "권")}` : m.bookAuthor && ` ${m.bookAuthor}`}
          </p>
        )}
        {!hideStore && (
          <p className="mt-0.5 text-b2 text-ink-3">
            {/* 책방 이름을 누르면 책방 화면으로. 위아래로 누르는 영역을 넓혀 손가락으로도 누르기 쉽게 */}
            {joinDot(
              <Link
                href={`/s/${m.store.id}`}
                className="relative z-10 -my-1.5 inline-block py-1.5 underline decoration-border underline-offset-4 hover:text-navy hover:decoration-navy"
              >
                {m.store.name}
              </Link>,
              m.store.region,
            )}
          </p>
        )}
        {/* 태그는 상자 없이 한 줄 글자로 모두 같은 굵기. '기타'는 알려 주는 게 없어 뺀다 */}
        <p className="mt-2 text-l2 font-normal text-ink-3">{hashTags([m.tagGenre, m.tagFormat, m.tagCadence].filter((t) => t !== "기타"))}</p>
      </div>
      {/* 하트 그림(24px)의 오른쪽·위 끝을 카드 안쪽 여백 선(오른쪽 8px·위 16px)에 맞춘다: 36px 원 안에서 그림은 6px 안쪽이라 원을 오른쪽 2px·위 10px에 둔다 */}
      {wish && (
        <div className="absolute right-0.5 top-2.5 z-10">
          <WishButton kind="meeting" id={m.id} wished={wish.wished} loggedIn={wish.loggedIn} label={m.title} size="sm" />
        </div>
      )}
    </div>
  );
}

// 책 없는 모임의 표지 그림: 글쓰기는 모임 방식으로, 보드게임은 따로 방식이 없어(기타) 모임 이름으로 고른다.
// 나머지는 책 읽는 부엉이 기본 그림. 플리마켓은 독서 모임이 아니라 그림 없이 둔다
function meetingArt(m: Meeting): string | null {
  if (m.tagFormat === "글쓰기") return "/meeting-art/writing.webp";
  if (m.title.includes("보드게임")) return "/meeting-art/boardgame.webp";
  if (m.title.includes("플리마켓")) return null;
  return "/meeting-art/default.webp";
}

// 책 표지(2:3). 표지를 못 찾으면 같은 크기의 종이 질감 칸에 책 제목을 세로로 얹어 목록 정렬을 유지한다.
function BookCover({ url, title, art }: { url: string | null; title: string | null; art: string | null }) {
  const box = "relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-xs";
  if (url) {
    return (
      <div className={`${box} bg-fill ring-1 ring-border`}>
        <Image src={url} alt={title ? `『${title}』 표지` : "책 표지"} fill sizes="72px" unoptimized className="object-cover" />
      </div>
    );
  }
  // 책이 없는 모임: 모임 종류에 맞춘 부엉이 그림(public/meeting-art, 2:3)
  if (!title && art) {
    return (
      <div aria-hidden className={`${box} bg-cream ring-1 ring-border`}>
        <Image src={art} alt="" fill sizes="72px" className="object-cover" />
      </div>
    );
  }
  // 그림도 없는 모임(플리마켓): 같은 크기 칸에 부엉이만 가운데 둔다(목록 정렬 유지, 모임 이름은 바로 옆에 있음)
  if (!title) {
    return (
      <div aria-hidden className={`${box} flex items-center justify-center bg-cream ring-1 ring-border`}>
        <span className="text-2xl opacity-60">🦉</span>
      </div>
    );
  }
  // 표지 대신 책 페이지 느낌: 일러스트 전용 크림색 표면(글자는 ink 계열)
  return (
    <div aria-hidden className={`${box} flex flex-col justify-between bg-cream p-2 ring-1 ring-border`}>
      <span className="line-clamp-4 text-l2 font-semibold text-ink-2">{title}</span>
      <span className="self-end text-sm opacity-60">🦉</span>
    </div>
  );
}
