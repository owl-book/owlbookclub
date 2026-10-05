import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { MeetingList } from "@/components/MeetingList";
import { PendingApplies } from "@/components/PendingApplies";
import { SubmitButton } from "@/components/SubmitButton";
import { Toast } from "@/components/Toast";
import { WishButton } from "@/components/WishButton";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import {
  getClickedMeetingIds,
  getMeetingsByIds,
  getPendingApplies,
  getPlans,
  getProfile,
  getRecords,
  getWishContext,
  getWishedMeetings,
  getWishedStores,
  type Plan,
  type RecordWithMeeting,
  type WishedStore,
} from "@/lib/me";
import { setAttended } from "@/lib/me-actions";
import { isPast, type Meeting } from "@/lib/meetings";
import { PROVIDERS, isProviderId } from "@/lib/oauth";
import { formatDateString, formatKst, formatKstDateOnly, formatKstTime, kstDayNumber } from "@/lib/time";
import { getTrackContext } from "@/lib/tracking";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

const TABS = [
  { key: "meetings", label: "찜한 모임" },
  { key: "stores", label: "찜한 책방" },
  { key: "mine", label: "내 모임" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// '다녀오셨나요?' 안내: 신청 표시한 모임은 기간과 관계없이, 찜·신청 클릭만 한 모임은 지난 지 이 기간 안의 것만
const ASK_DAYS = 60;
const ASK_MAX = 5;

export default async function MyPage({ searchParams }: PageProps<"/me">) {
  // 로그인 키 유무는 배포 환경에서 판단해야 하므로, 조립할 때 미리 만들어 두지 않고 방문할 때마다 그린다
  await connection();
  if (!isAuthEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const sp = await searchParams;
  // 예전 주소(?tab=records)는 '내 모임'으로
  const tab: TabKey = sp.tab === "records" ? "mine" : TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "meetings";
  const now = new Date();

  // 서로 기다릴 필요가 없는 조회는 한꺼번에 묻는다(하나씩 차례로 물으면 그만큼 화면이 늦게 뜬다)
  const { visitorId } = await getTrackContext();
  const who = { userId: user.id, visitorId };
  const askSince = now.getTime() - ASK_DAYS * 86400000;
  const [profileResult, data, wishes, plans, clickedIds] = await Promise.all([
    getProfile(user.id).then(
      (profile) => ({ ok: true as const, profile }),
      (e) => {
        // 회원 저장 공간(0002·0003 설정문)을 아직 만들지 않았을 때
        console.error("[owl] profile load failed", e);
        return { ok: false as const };
      },
    ),
    Promise.all([getWishedMeetings(user.id), getWishedStores(user.id, now), getRecords(user.id)]).then(
      ([meetings, stores, records]) => ({ meetings, stores, records }),
      (e) => {
        // 찜·기록 저장 공간(0003 설정문)을 아직 만들지 않았을 때
        console.error("[owl] mypage load failed", e);
        return { meetings: [] as Meeting[], stores: [] as WishedStore[], records: [] as RecordWithMeeting[] };
      },
    ),
    getWishContext(),
    // 내 모임(신청 표시·다녀옴). 0009 설정문 실행 전이면 비어 있는 것으로 본다
    getPlans(user.id).catch((e): Plan[] => {
      console.error("[owl] plans load failed", e);
      return [];
    }),
    getClickedMeetingIds(who, new Date(askSince)),
  ]);

  if (!profileResult.ok) {
    return (
      <div className="pt-10">
        <Empty title="마이페이지를 준비하고 있어요" body="잠시 뒤 다시 들어와 주세요." />
        <LogoutButton />
      </div>
    );
  }
  const profile = profileResult.profile;
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

  const planBy = new Map(plans.map((p) => [p.meetingId, p]));
  const recorded = new Set(data.records.map((r) => r.meetingId));
  const upcoming = data.meetings.filter((m) => !isPast(m, now));
  const pastWished = data.meetings.filter((m) => isPast(m, now)).reverse();

  // 신청한 모임(다가오는 일정)
  const appliedUpcoming = plans
    .filter((p) => p.appliedAt && !isPast(p.meeting, now))
    .map((p) => p.meeting)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // 다녀온 모임: '다녀왔어요'를 눌렀거나 기록을 남긴 모임(기록이 있으면 함께 보여 준다)
  const recordBy = new Map(data.records.map((r) => [r.meetingId, r]));
  const wentIds = new Set([...plans.filter((p) => p.attended === "yes").map((p) => p.meetingId), ...recorded]);
  const went = [...wentIds]
    .map((id) => ({ meeting: recordBy.get(id)?.meeting ?? planBy.get(id)!.meeting, record: recordBy.get(id) ?? null }))
    .sort((a, b) => b.meeting.startsAt.getTime() - a.meeting.startsAt.getTime());
  // 못 간 모임: 목록에서는 빼고, 맨 아래 접힌 칸에서 되돌릴 수 있게 둔다
  const missed = plans
    .filter((p) => p.attended === "no" && !recorded.has(p.meetingId))
    .map((p) => p.meeting)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  // 다녀오셨나요? 아직 확인하지 않은 지난 모임: 신청 표시 → 찜 → 신청 페이지만 열어 본 모임 순
  const unanswered = (m: Meeting) => isPast(m, now) && !recorded.has(m.id) && !planBy.get(m.id)?.attended;
  const askApplied = plans.filter((p) => p.appliedAt && unanswered(p.meeting)).map((p) => p.meeting);
  const askWished = pastWished.filter((m) => unanswered(m) && m.startsAt.getTime() >= askSince);
  // 두 번째 묶음: 위 결과가 있어야 물을 수 있는 것들(신청 페이지만 열어 본 모임, 신청하셨나요? 후보)
  const appliedIds = new Set(plans.filter((p) => p.appliedAt).map((p) => p.meetingId));
  const [clickedMeetings, pendingMeetings] = await Promise.all([
    getMeetingsByIds(clickedIds).catch((e): Meeting[] => {
      console.error("[owl] clicked meetings load failed", e);
      return [];
    }),
    // 신청하셨나요? 신청 페이지를 열어 본 뒤 표시를 놓친 다가오는 모임(내 모임 탭에서만)
    tab === "mine"
      ? getPendingApplies(who, appliedIds, now).catch((e): Meeting[] => {
          console.error("[owl] pending applies load failed", e);
          return [];
        })
      : ([] as Meeting[]),
  ]);
  const askClicked = clickedMeetings.filter((m) => unanswered(m) && m.startsAt.getTime() >= askSince);
  const askSeen = new Set<number>();
  const toAsk = [...askApplied.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()), ...askWished, ...askClicked]
    .filter((m) => (askSeen.has(m.id) ? false : (askSeen.add(m.id), true)))
    .slice(0, ASK_MAX);

  const pendingItems = pendingMeetings.map((m) => ({ id: m.id, title: m.title, storeName: m.store.name, when: formatKst(m.startsAt) }));

  const attendedMeeting = typeof sp.attended === "string" ? went.find((w) => String(w.meeting.id) === sp.attended)?.meeting : undefined;
  const counts: Record<TabKey, number> = { meetings: data.meetings.length, stores: data.stores.length, mine: appliedUpcoming.length + went.length };

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
          내 정보
        </Link>
      </section>

      {/* 다녀오셨나요? */}
      {toAsk.length > 0 && (
        <section aria-label="다녀왔는지 확인" className="mt-4 rounded-md border border-info-border bg-info-surface p-4">
          <p className="text-t2 text-ink">다녀오셨나요?</p>
          <p className="mt-0.5 text-b2 text-ink-2">모임 날짜가 지났어요. 다녀온 모임은 ‘내 모임’에 모아 두고, 기억이 생생할 때 기록도 남길 수 있어요.</p>
          <ul className="mt-3 space-y-2">
            {toAsk.map((m) => (
              <li key={m.id} className="rounded-sm bg-card px-3 py-2.5">
                <span className="block truncate text-l1 text-ink">{m.title}</span>
                <span className="mt-0.5 block text-l2 font-normal text-ink-3">
                  {formatKstDateOnly(m.startsAt)} · {m.store.name}
                  {planBy.get(m.id)?.appliedAt && " · 신청 표시한 모임"}
                </span>
                <form action={setAttended} className="mt-2 flex gap-2">
                  <input type="hidden" name="meetingId" value={m.id} />
                  <SubmitButton
                    name="attended"
                    value="no"
                    pendingText="저장하는 중…"
                    className="min-h-11 flex-1 rounded-sm border border-border bg-card text-l1 text-ink-2 hover:bg-sub"
                  >
                    못 갔어요
                  </SubmitButton>
                  <SubmitButton
                    name="attended"
                    value="yes"
                    pendingText="저장하는 중…"
                    className="min-h-11 flex-[1.4] rounded-sm bg-navy text-l1 font-semibold text-white hover:bg-navy-hover"
                  >
                    다녀왔어요
                  </SubmitButton>
                </form>
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
                      <Link href={`/s/${s.id}`} className="-my-2 inline-flex min-h-11 items-center text-t2 text-ink underline decoration-border-strong underline-offset-4 hover:text-navy">
                        {s.name}
                      </Link>
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

        {tab === "mine" && (
          <>
            {typeof sp.saved === "string" && (
              <Toast message="기록을 저장했어요" clearParam="saved" focusId={went.some((w) => String(w.meeting.id) === sp.saved) ? `record-${sp.saved}` : undefined} />
            )}
            {sp.deleted === "1" && <Toast message="기록을 지웠어요" clearParam="deleted" />}
            {attendedMeeting && (
              <Notice>
                ‘{attendedMeeting.title}’을(를) 다녀온 모임에 담았어요.{" "}
                <Link href={`/me/records/${attendedMeeting.id}`} className="font-semibold underline">
                  지금 기록하기
                </Link>
              </Notice>
            )}
            {typeof sp.missed === "string" && (
              <Notice>
                <span className="flex flex-wrap items-center justify-between gap-x-3">
                  <span>못 간 모임으로 표시했어요. 내 모임 목록에서는 빠져요.</span>
                  <UndoAttended meetingId={Number(sp.missed)} label="되돌리기" />
                </span>
              </Notice>
            )}
            {sp.cleared === "1" && <Notice>표시를 되돌렸어요.</Notice>}

            <p className="mb-4 text-l2 font-normal leading-normal text-ink-3">
              🔒 내 모임과 기록은 나만 볼 수 있어요. 책방이나 다른 사람에게 보이지 않아요.
              <br />
              신청·취소·변경은 각 책방에서 해 주세요.
            </p>

            <PendingApplies items={pendingItems} loggedIn />

            {appliedUpcoming.length === 0 && went.length === 0 ? (
              <Empty
                title="아직 담긴 모임이 없어요"
                body="모임 상세에서 책방 신청을 마친 뒤 ‘책방에서 신청했어요’를 누르면 여기에 날짜순으로 모여요. 다녀온 뒤에는 나만 보는 기록도 남길 수 있어요."
              />
            ) : (
              <>
                <section aria-labelledby="mine-upcoming">
                  <h2 id="mine-upcoming" className="mb-2 flex items-baseline justify-between text-l1 font-semibold text-ink-2">
                    신청한 모임 <span className="text-l2 font-normal text-ink-3">{appliedUpcoming.length}</span>
                  </h2>
                  {appliedUpcoming.length === 0 ? (
                    <p className="rounded-sm bg-sub px-3 py-2.5 text-b2 text-ink-2">다가오는 신청 모임이 없어요. 모임 상세에서 ‘책방에서 신청했어요’를 누르면 여기에 모여요.</p>
                  ) : (
                    <ul className="space-y-2">
                      {appliedUpcoming.map((m) => (
                        <li key={m.id}>
                          <PlanCard meeting={m} now={now} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {appliedUpcoming.length > 0 && (
                    <p className="mt-2 text-l2 font-normal leading-normal text-ink-3">일정은 마지막으로 확인한 정보예요. 정확한 일정은 책방 공지를 기준으로 확인해 주세요.</p>
                  )}
                </section>

                {went.length > 0 && (
                  <section aria-labelledby="mine-went" className="mt-8">
                    <h2 id="mine-went" className="mb-2 flex items-baseline justify-between text-l1 font-semibold text-ink-2">
                      다녀온 모임 <span className="text-l2 font-normal text-ink-3">{went.length}</span>
                    </h2>
                    <ul className="space-y-3">
                      {went.map(({ meeting: m, record: r }) => (
                        <li key={m.id} id={`record-${m.id}`} className="scroll-mt-20">
                          <Link
                            href={`/me/records/${m.id}`}
                            className={`block rounded-md border border-border-card bg-card p-4 hover:border-border-strong ${sp.saved === String(m.id) ? "owl-just-saved" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-l2 font-normal text-ink-3">
                                {formatKstDateOnly(m.startsAt)} · {m.store.name}
                              </span>
                              {r?.rating ? <Stars value={r.rating} /> : !r && <span className="shrink-0 text-l1 text-navy">기록하기</span>}
                            </div>
                            <p className="mt-1.5 text-t2 text-ink">{m.title}</p>
                            {m.bookTitle && (
                              <p className="mt-0.5 text-b2 text-ink-2">
                                『{m.bookTitle}』{m.bookAuthor && ` ${m.bookAuthor}`}
                              </p>
                            )}
                            {r?.quote && (
                              <blockquote className="mt-3 line-clamp-3 border-l-2 border-border-strong pl-3 text-b2 text-ink-2">{r.quote}</blockquote>
                            )}
                            {r?.memo && <p className="mt-2 line-clamp-2 whitespace-pre-line text-b2 text-ink-2">{r.memo}</p>}
                          </Link>
                          {/* 기록 없이 '다녀왔어요'만 누른 모임은 표시를 되돌릴 수 있다(기록이 있으면 기록 화면에서 지운다) */}
                          {!r && (
                            <div className="mt-1 flex justify-end">
                              <UndoAttended meetingId={m.id} label="다녀온 표시 취소" />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {missed.length > 0 && (
              <details className="mt-8 rounded-md border border-border bg-sub px-4 py-1">
                <summary className="flex min-h-11 cursor-pointer items-center text-l1 text-ink-2">못 간 모임 {missed.length}</summary>
                <ul className="divide-y divide-border pb-2">
                  {missed.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-l1 text-ink">{m.title}</span>
                        <span className="mt-0.5 block text-l2 font-normal text-ink-3">
                          {formatKstDateOnly(m.startsAt)} · {m.store.name}
                        </span>
                      </span>
                      <UndoAttended meetingId={m.id} label="되돌리기" />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 평소 로그아웃은 내 정보 화면에 있다. 여기는 회원 정보를 불러오지 못해 내 정보로 갈 수 없을 때만 쓴다
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
    <div role="status" className="mb-4 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
      {children}
    </div>
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

// 신청한 모임 카드: 날짜 칸 + 제목·책방·시간 + D-day.
// 게재를 내린 책방의 모임은 상세 화면이 없으므로 링크 없이 글자로만 보여 준다.
function PlanCard({ meeting: m, now }: { meeting: Meeting; now: Date }) {
  const d = new Date(m.startsAt.getTime() + 9 * 3600000);
  const days = kstDayNumber(m.startsAt) - kstDayNumber(now);
  const dday = days === 0 ? "오늘" : days === 1 ? "내일" : `D-${days}`;
  const body = (
    <div className="flex gap-3">
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-sm bg-fill py-1.5">
        <span className="font-display text-t1 leading-none text-navy">{d.getUTCDate()}</span>
        <span className="mt-1 text-l2 text-ink-3">{d.getUTCMonth() + 1}월</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-l1 font-semibold text-ink">{m.title}</p>
        <p className="mt-0.5 text-l2 font-normal text-ink-3">
          {formatKstDateOnly(m.startsAt)} {formatKstTime(m.startsAt)} · {m.store.name}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-xs border border-info-border bg-info-surface px-1.5 text-l2 text-navy">{dday}</span>
          {m.status === "closed" && <span className="rounded-xs bg-fill px-1.5 text-l2 text-ink-2">신청 마감</span>}
          {m.hidden ? (
            <span className="text-l2 font-normal text-ink-3">게재가 내려간 모임이에요</span>
          ) : (
            <span className="text-l2 font-normal text-ink-3">{formatDateString(m.lastCheckedAt)} 확인</span>
          )}
        </p>
      </div>
    </div>
  );
  return m.hidden ? (
    <div className="rounded-md border border-border-card bg-sub p-3">{body}</div>
  ) : (
    <Link href={`/m/${m.id}`} className="block rounded-md border border-border-card bg-card p-3 hover:border-border-strong">
      {body}
    </Link>
  );
}

// '다녀왔어요'·'못 갔어요' 표시를 확인 전 상태로 되돌린다
function UndoAttended({ meetingId, label }: { meetingId: number; label: string }) {
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0) return null;
  return (
    <form action={setAttended}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <SubmitButton name="attended" value="clear" pendingText="되돌리는 중…" className="inline-flex min-h-11 shrink-0 items-center px-1 text-l2 text-ink-2 underline hover:text-navy">
        {label}
      </SubmitButton>
    </form>
  );
}
