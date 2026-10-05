import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { MeetingList } from "@/components/MeetingList";
import { PinIcon } from "@/components/PinIcon";
import { WishButton } from "@/components/WishButton";
import { getWishContext } from "@/lib/me";
import { getStore, getStoreMeetings } from "@/lib/stores";

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getStore(Number(id));
  if (!s) return { title: "책방을 찾을 수 없어요" };
  const description = s.intro ? `${s.intro} · ${s.region}` : `${s.region} 동네책방 ${s.name}의 독서모임`;
  return {
    title: s.name,
    description,
    openGraph: { title: `${s.name} | 부엉이들의 서재`, description },
    alternates: { canonical: `/s/${s.id}` },
  };
}

// 책방 상세: 남색 '간판'(지역·이름·한 줄 소개·찜) → 위치·운영시간·대표번호·인스타 → 이 책방의 독서모임.
// 운영시간·대표번호는 네이버 플레이스에서 옮겨 적은 것이라, 있으면 그 출처를 칸 아래에 함께 밝힌다.
// 책방 홍보 이미지는 쓰지 않는다(게재 원칙). 앰버 버튼도 쓰지 않는다: 이 화면의 일은 모임 고르기이고, 책방으로 나가는 신청은 모임 상세에서 한다.
export default async function StorePage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  const s = await getStore(Number(id));
  if (!s) notFound();

  const now = new Date();
  const [{ upcoming, past }, wishes] = await Promise.all([getStoreMeetings(s.id, now), getWishContext()]);
  const loggedIn = Boolean(wishes.user);
  const handle = s.instagramUrl ? instagramHandle(s.instagramUrl) : null;

  return (
    <article className="pt-2">
      <BackLink label="뒤로" />

      <header className="mt-1 rounded-lg bg-dk-card px-5 pb-5 pt-6">
        <p className="text-l1 text-dk-ink-2">{s.region}</p>
        <h1 className="mt-1 font-display text-h1 text-dk-ink">{s.name}</h1>
        {s.intro && <p className="mt-2 max-w-prose text-b1 text-dk-ink-2">{s.intro}</p>}
        {wishes.enabled && (
          <div className="mt-5">
            <span className="inline-flex min-h-11 items-center rounded-sm bg-card pl-3 pr-1">
              <span className="text-l1 text-ink-2">책방 찜</span>
              <WishButton kind="store" id={s.id} wished={wishes.storeIds.has(s.id)} loggedIn={loggedIn} label={s.name} size="sm" />
            </span>
          </div>
        )}
      </header>

      {/* 찾아가는 정보(위치·운영시간·대표번호·인스타)는 한 칸에 모은다. 모두 없으면 칸을 빼고, 있는 줄만 */}
      {(s.address || s.hours || s.phone || s.instagramUrl) && (
        <div className="mt-4 rounded-md border border-border-card bg-card p-4">
          <dl className="space-y-3 text-b2 text-ink">
            {s.address && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">위치</dt>
                <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
                  <span className="min-w-0 break-keep">{s.address}</span>
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(s.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.name} 위치를 네이버 지도에서 보기`}
                    className={EXTERNAL_LINK}
                  >
                    <PinIcon />
                    지도
                  </a>
                </dd>
              </div>
            )}
            {s.hours && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">운영시간</dt>
                <dd className="min-w-0 flex-1 whitespace-pre-line break-keep">{s.hours}</dd>
              </div>
            )}
            {s.phone && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">대표번호</dt>
                <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
                  <span className="min-w-0">{s.phone}</span>
                  <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} aria-label={`${s.name}에 전화 걸기`} className={EXTERNAL_LINK}>
                    전화
                  </a>
                </dd>
              </div>
            )}
            {s.instagramUrl && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">인스타</dt>
                <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
                  {/* 주소에서 계정 이름을 못 읽으면(게시물 링크 등) 왼쪽은 비우고 링크만 둔다 */}
                  <span className="min-w-0">
                    {/* 긴 계정 이름은 단어 중간이 아니라 _ · . 뒤에서 줄을 바꾼다 */}
                    {handle &&
                      `@${handle}`.split(/(?<=[._])/).map((part, i) => (
                        <span key={i}>
                          {i > 0 && <wbr />}
                          {part}
                        </span>
                      ))}
                  </span>
                  <a
                    href={s.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.name} 인스타그램 계정 보기 (새 창)`}
                    className={EXTERNAL_LINK}
                  >
                    책방 계정 보기 ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {(s.hours || s.phone) && (
            <p className="mt-4 border-t border-border-card pt-3 text-l2 font-normal text-ink-3">
              운영시간·대표번호는 네이버 플레이스 정보를 기준으로 했어요. 휴무나 시간이 바뀔 수 있으니 방문 전에 한 번 더 확인해 주세요.
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="store-meetings" className="mt-8">
        <h2 id="store-meetings" className="text-t2 text-ink">
          이 책방의 독서모임
          {upcoming.length > 0 && <span className="ml-1.5 text-l1 text-ink-3">{upcoming.length}개</span>}
        </h2>
        <div className="mt-2">
          {upcoming.length > 0 ? (
            <MeetingList meetings={upcoming} now={now} wishes={wishes} hideStore />
          ) : (
            <div className="rounded-md bg-sub px-4 py-4 text-b2 text-ink-2">
              <p className="font-semibold text-ink">다가오는 모임이 아직 없어요</p>
              {wishes.enabled && <p className="mt-1">책방을 찜해 두면 새 모임이 올라올 때 마이페이지 ‘찜한 책방’에서 바로 볼 수 있어요.</p>}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <details className="group mt-6">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-l1 text-ink-2 hover:text-navy [&::-webkit-details-marker]:hidden">
              지난 모임 {past.length}개 <span className="group-open:hidden">보기</span>
              <span className="hidden group-open:inline">접기</span>
              <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="mt-2">
              <MeetingList meetings={past} now={now} wishes={wishes} hideStore />
            </div>
          </details>
        )}
      </section>

      {/* 이용자·운영자 모두 쓰는 입구: 이 책방만 미리 골라 두고 종류는 비워 둔다(게시 멈추기는 '그 밖의 문의'에서 고름) */}
      <div className="mt-8 space-y-1 text-l2 font-normal text-ink-3">
        <p>책방 정보와 모임 일정은 책방 공지가 기준이에요.</p>
        <p>
          책방 정보가 다르면{" "}
          <Link href={`/contact?store=${s.id}`} className="-my-3 inline-flex min-h-11 items-center text-navy underline underline-offset-2 hover:text-navy-hover">
            알려주기
          </Link>
        </p>
      </div>
    </article>
  );
}

// 위치 '지도'·대표번호 '전화'·인스타 '책방 계정 보기' 링크: 글자는 작게, 누르는 영역은 44px
const EXTERNAL_LINK =
  "-my-3 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-l2 text-navy underline underline-offset-2 hover:text-navy-hover";

// https://www.instagram.com/owl_books/ → owl_books. 게시물(/p/…)·릴스 등 계정 주소가 아니면 null
function instagramHandle(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (["p", "reel", "reels", "stories", "explore", "tv"].includes(first.toLowerCase())) return null;
    return /^[A-Za-z0-9._]{1,30}$/.test(first) ? first : null;
  } catch {
    return null;
  }
}
