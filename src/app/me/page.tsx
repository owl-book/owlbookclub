import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { MeetingList } from "@/components/MeetingList";
import { WishButton } from "@/components/WishButton";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import {
  getProfile,
  getRecords,
  getWishContext,
  getWishedMeetings,
  getWishedStores,
  type RecordWithMeeting,
  type WishedStore,
} from "@/lib/me";
import { isPast, type Meeting } from "@/lib/meetings";
import { PROVIDERS, isProviderId } from "@/lib/oauth";
import { formatKst, formatKstDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

const TABS = [
  { key: "meetings", label: "찜한 모임" },
  { key: "stores", label: "찜한 책방" },
  { key: "records", label: "나의 기록" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// '다녀오셨나요?' 안내는 지난 지 이 기간 안의 찜 모임만
const ASK_DAYS = 60;

export default async function MyPage({ searchParams }: PageProps<"/me">) {
  // 로그인 키 유무는 배포 환경에서 판단해야 하므로, 조립할 때 미리 만들어 두지 않고 방문할 때마다 그린다
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "meetings";
  const now = new Date();

  let profile: Awaited<ReturnType<typeof getProfile>>;
  try {
    profile = await getProfile(user.id);
  } catch (e) {
    // 회원 저장 공간(0002·0003 설정문)을 아직 만들지 않았을 때
    console.error("[owl] profile load failed", e);
    return (
      <div className="pt-10">
        <Empty title="마이페이지를 준비하고 있어요" body="잠시 뒤 다시 들어와 주세요." />
        <LogoutButton />
      </div>
    );
  }
  if (!profile) {
    // 로그인 쿠키는 남아 있는데 회원 정보가 없는 경우(탈퇴 처리 등)
    return (
      <div className="pt-10">
        <p className="text-t2 text-ink">회원 정보를 찾을 수 없어요</p>
        <p className="mt-1 text-b2 text-ink-2">로그아웃한 뒤 다시 로그인해 주세요.</p>
        <LogoutButton />
      </div>
    );
  }

  let data: { meetings: Meeting[]; stores: WishedStore[]; records: RecordWithMeeting[] };
  try {
    const [meetings, stores, records] = await Promise.all([getWishedMeetings(user.id), getWishedStores(user.id, now), getRecords(user.id)]);
    data = { meetings, stores, records };
  } catch (e) {
    // 찜·기록 저장 공간(0003 설정문)을 아직 만들지 않았을 때
    console.error("[owl] mypage load failed", e);
    data = { meetings: [], stores: [], records: [] };
  }
  const wishes = await getWishContext();

  const recorded = new Set(data.records.map((r) => r.meetingId));
  const upcoming = data.meetings.filter((m) => !isPast(m, now));
  const pastWished = data.meetings.filter((m) => isPast(m, now)).reverse();
  const askSince = now.getTime() - ASK_DAYS * 86400000;
  const toAsk = pastWished.filter((m) => !recorded.has(m.id) && m.startsAt.getTime() >= askSince).slice(0, 3);
  const counts: Record<TabKey, number> = { meetings: data.meetings.length, stores: data.stores.length, records: data.records.length };

  const providerLabel = isProviderId(profile.provider) ? PROVIDERS[profile.provider].label : profile.provider;
  const name = profile.displayName || profile.nickname || "회원";

  return (
    <div className="pt-5">
      <h1 className="sr-only">마이페이지</h1>

      {sp.updated === "1" && <Notice>별명을 바꿨어요.</Notice>}

      {/* 기본정보 */}
      <section aria-label="기본정보" className="flex items-center gap-3.5 rounded-md border border-border-card bg-card p-4">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--illustration-cream)] text-2xl">
          🦉
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-t1 text-ink">{name}님</p>
          <p className="mt-0.5 text-l2 font-normal text-ink-3">
            {providerLabel}로 로그인 · <span className="whitespace-nowrap">{formatKstDateOnly(profile.createdAt).replace(/ \(.\)$/, "")} 가입</span>
          </p>
        </div>
        <Link href="/me/account" className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-border px-3 text-l1 text-ink-2 hover:bg-sub">
          별명 바꾸기
        </Link>
      </section>

      {/* 다녀오셨나요? */}
      {toAsk.length > 0 && (
        <section aria-label="기록 안내" className="mt-4 rounded-md border border-info-border bg-info-surface p-4">
          <p className="text-t2 text-ink">다녀오셨나요?</p>
          <p className="mt-0.5 text-b2 text-ink-2">찜한 모임이 지났어요. 기억이 생생할 때 남겨 두세요. 기록은 나만 볼 수 있어요.</p>
          <ul className="mt-3 space-y-2">
            {toAsk.map((m) => (
              <li key={m.id}>
                <Link href={`/me/records/${m.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-sm bg-card px-3 py-2.5 hover:bg-sub">
                  <span className="min-w-0">
                    <span className="block truncate text-l1 text-ink">{m.title}</span>
                    <span className="mt-0.5 block text-l2 font-normal text-ink-3">
                      {formatKstDateOnly(m.startsAt)} · {m.store.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-l1 text-navy">기록하기 →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 탭 */}
      <nav aria-label="마이페이지 메뉴" className="-mx-4 mt-5 border-b border-border px-4">
        <ul className="flex">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <li key={t.key} className="flex-1">
                <Link
                  href={`/me?tab=${t.key}`}
                  replace
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-12 items-center justify-center gap-1 border-b-2 text-l1 ${on ? "border-navy font-semibold text-navy" : "border-transparent text-ink-3 hover:text-ink-2"}`}
                >
                  {t.label}
                  <span className={on ? "text-navy" : "text-ink-3"}>{counts[t.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4">
        {tab === "meetings" && (
          <>
            {upcoming.length > 0 ? (
              <MeetingList meetings={upcoming} now={now} wishes={wishes} />
            ) : (
              <Empty title="다가오는 찜한 모임이 없어요" body="모임 카드의 하트를 누르면 여기에 모여요." />
            )}
            {pastWished.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-l1 font-semibold text-ink-2">지난 찜 모임</h2>
                <ul className="divide-y divide-border rounded-md border border-border-card bg-card">
                  {pastWished.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <Link href={`/m/${m.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-l1 text-ink">{m.title}</span>
                        <span className="mt-0.5 block text-l2 font-normal text-ink-3">
                          {formatKstDateOnly(m.startsAt)} · {m.store.name}
                        </span>
                      </Link>
                      <Link
                        href={`/me/records/${m.id}`}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-border-strong px-3 text-l1 text-navy hover:bg-sub"
                      >
                        {recorded.has(m.id) ? "기록 보기" : "기록하기"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === "stores" &&
          (data.stores.length === 0 ? (
            <Empty title="찜한 책방이 없어요" body="모임 상세 화면의 책방 이름 옆 하트를 누르면 여기에 모여요." />
          ) : (
            <ul className="space-y-3">
              {data.stores.map((s) => (
                <li key={s.id} className="rounded-md border border-border-card bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-t2 text-ink">{s.name}</p>
                      <p className="mt-0.5 text-b2 text-ink-3">
                        {s.region}
                        {s.instagramUrl && (
                          <>
                            {" · "}
                            <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="underline">
                              인스타그램 ↗
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="-mr-2 -mt-2">
                      <WishButton kind="store" id={s.id} wished loggedIn label={s.name} />
                    </div>
                  </div>
                  {s.upcoming.length === 0 ? (
                    <p className="mt-3 rounded-sm bg-sub px-3 py-2.5 text-b2 text-ink-2">다가오는 모임이 아직 없어요. 새 모임이 올라오면 여기에 보여요.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border border-t border-border">
                      {s.upcoming.slice(0, 5).map((m) => (
                        <li key={m.id}>
                          <Link href={`/m/${m.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2.5 hover:text-navy">
                            <span className="min-w-0">
                              <span className="block truncate text-l1 text-ink">{m.title}</span>
                              <span className="mt-0.5 block text-l2 font-normal text-ink-3">{formatKst(m.startsAt)}</span>
                            </span>
                            <span aria-hidden className="text-ink-3">›</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "records" && (
          <>
            {sp.saved === "1" && <Notice>기록을 저장했어요.</Notice>}
            <p className="mb-3 text-l2 font-normal text-ink-3">🔒 기록은 나만 볼 수 있어요. 책방이나 다른 사람에게 보이지 않아요.</p>
            {data.records.length === 0 ? (
              <Empty title="아직 남긴 기록이 없어요" body="지난 모임 상세 화면에서 ‘다녀왔어요 · 기록하기’를 누르면 여기에 모여요." />
            ) : (
              <ul className="space-y-3">
                {data.records.map((r) => (
                  <li key={r.meetingId}>
                    <Link href={`/me/records/${r.meetingId}`} className="block rounded-md border border-border-card bg-card p-4 hover:border-border-strong">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-l2 font-normal text-ink-3">
                          {formatKstDateOnly(r.meeting.startsAt)} · {r.meeting.store.name}
                        </span>
                        {r.rating && <Stars value={r.rating} />}
                      </div>
                      <p className="mt-1.5 text-t2 text-ink">{r.meeting.title}</p>
                      {r.meeting.bookTitle && <p className="mt-0.5 text-b2 text-ink-2">『{r.meeting.bookTitle}』</p>}
                      {r.quote && (
                        <blockquote className="mt-3 line-clamp-3 border-l-2 border-border-strong pl-3 text-b2 text-ink-2">{r.quote}</blockquote>
                      )}
                      {r.memo && <p className="mt-2 line-clamp-2 whitespace-pre-line text-b2 text-ink-2">{r.memo}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="mt-10 flex items-center gap-4 border-t border-border pt-4">
        <LogoutButton />
        <Link href="/me/account#withdraw" className="inline-flex min-h-11 items-center text-l2 text-ink-3 underline">
          회원 탈퇴
        </Link>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/auth/logout" method="post">
      <button type="submit" className="inline-flex min-h-11 items-center text-l1 text-ink-2 underline hover:text-navy">
        로그아웃
      </button>
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mb-4 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
      {children}
    </p>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
      <p className="text-t2 text-ink">{title}</p>
      <p className="mt-1 text-b2 text-ink-2">{body}</p>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`만족도 5점 중 ${value}점`} className="text-l1 tracking-tight text-navy">
      {"★".repeat(value)}
      <span className="text-border-card">{"★".repeat(5 - value)}</span>
    </span>
  );
}
