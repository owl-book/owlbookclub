import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminNav } from "@/components/AdminNav";
import { ExhibitionCard } from "@/components/ExhibitionCard";
import { MeetingCard } from "@/components/MeetingCard";
import { PosterUploadForm } from "@/components/PosterUploadForm";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/Tag";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { smsNumber } from "@/lib/apply";
import { getCoverBooks } from "@/lib/book-covers";
import { getInquiryInbox, getReportInbox } from "@/lib/reports";
import { approveExhibition, rejectExhibition } from "@/lib/exhibition-actions";
import { KIND_LABEL } from "@/lib/exhibitions";
import { autoMeetingArt, MEETING_ARTS, meetingArtSrc } from "@/lib/meeting-art";
import { getPendingExhibitions, getReviewQueue, type PendingExhibition, type PendingMeeting, type PendingStore, type ReviewGroup } from "@/lib/review";
import { approveMeeting, approveStore, approveStoreAll, editPendingMeeting, editPendingStore, rejectMeeting, rejectStoreAll } from "@/lib/review-actions";
import { REGIONS, SIDOS } from "@/lib/regions";
import { FORMATS, GENRES } from "@/lib/tags";

// 운영자 전용 승인 대기 화면. Claude가 숨긴 채로 넣어 둔 모임·책방을 실제 카드 모양으로 보고 [승인]하면 바로 공개된다.
// 신고함과 마찬가지로 사이트 어디에도 링크하지 않고, 화면·동작 모두 출입증을 확인한다.
export const metadata: Metadata = { title: "승인 대기", robots: { index: false, follow: false } };

export default async function AdminReviewPage({ searchParams }: PageProps<"/admin/review">) {
  await connection();
  if (!isAdminEnabled()) notFound();
  if (!(await isAdmin())) return <AdminLogin next="/admin/review" />;

  const sp = await searchParams;
  const [queue, inbox, inquiries, books, exhibitions] = await Promise.all([getReviewQueue(), getReportInbox(), getInquiryInbox(), getCoverBooks(), getPendingExhibitions()]);
  const reportCount = inbox.reduce((n, item) => n + item.reports.length, 0) + inquiries.length;
  const total = (queue.ready ? queue.total : 0) + (exhibitions?.length ?? 0);
  const done = doneMessage(sp);
  const error = errorMessage(sp);
  const now = new Date();

  return (
    <div>
      <AdminNav current="review" counts={{ review: total, reports: reportCount, covers: books.filter((b) => !b.cover).length }} />
      <h1 className="mt-5 font-display text-h2 text-ink">승인 대기</h1>

      {!queue.ready ? (
        <p className="mt-4 rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-b2 text-ink">
          DB 설정이 아직 안 됐어요. Supabase SQL Editor에서 <strong>0023_review_queue.sql</strong>을 실행하면 이 화면을 쓸 수 있어요.
        </p>
      ) : (
        <>
          <p className="mt-1 text-b2 text-ink-2">
            {total > 0 ? (
              <>
                승인을 기다리는 모임 <strong className="text-ink">{queue.groups.reduce((n, g) => n + g.meetings.length, 0)}개</strong>
                {(exhibitions?.length ?? 0) > 0 && (
                  <>
                    {" "}
                    · 전시 <strong className="text-ink">{exhibitions!.length}개</strong>
                  </>
                )}
                {queue.groups.some((g) => g.store) && (
                  <>
                    {" "}
                    · 새 책방 <strong className="text-ink">{queue.groups.filter((g) => g.store).length}곳</strong>
                  </>
                )}
              </>
            ) : (
              "승인을 기다리는 모임이 없어요"
            )}
          </p>
          <p className="mt-2 text-b2 text-ink-2">
            손님에게 보일 카드 모양 그대로예요. 카드를 누르면 상세 화면도 미리 볼 수 있어요. [승인]을 누르면 바로 사이트에 올라가요.
          </p>
        </>
      )}

      {done && (
        <p role="status" className="mt-4 rounded-xs border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          {done}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xs border border-error bg-card px-3 py-2.5 text-b2 text-error">
          {error}
        </p>
      )}

      {queue.ready && total === 0 && (
        <p className="mt-6 rounded-md bg-sub px-4 py-6 text-center text-b2 text-ink-2">
          Claude에게 &ldquo;○○책방 모임 정리해줘&rdquo;라고 하면
          <br />
          정리한 모임이 여기에 모여요.
        </p>
      )}

      {queue.ready && queue.groups.length > 0 && (
        <ul className="mt-6 space-y-10">
          {queue.groups.map((g) => (
            <StoreGroup key={g.storeId} group={g} now={now} />
          ))}
        </ul>
      )}

      {exhibitions === null ? (
        <p className="mt-10 rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-b2 text-ink">
          전시 칸은 아직 DB 설정이 안 됐어요. Supabase SQL Editor에서 <strong>0024_exhibitions.sql</strong>을 실행하면 대기 중인 전시도 여기에 보여요.
        </p>
      ) : (
        exhibitions.length > 0 && (
          <section aria-labelledby="pending-exhibitions" className="mt-12">
            <h2 id="pending-exhibitions" className="border-b border-border pb-2 text-t1 text-ink">
              대기 중인 전시 <span className="text-l1 font-normal text-ink-3">{exhibitions.length}개</span>
            </h2>
            <p className="mt-2 text-b2 text-ink-2">포스터는 책방에 사용 허가를 받은 뒤에 공개해 주세요. 작품 사진은 올리지 않아요.</p>
            <ul className="mt-4 space-y-8">
              {exhibitions.map((e) => (
                <ExhibitionItem key={e.id} e={e} now={now} />
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

function doneMessage(sp: Record<string, string | string[] | undefined>): string | undefined {
  const n = Number(sp.n) || 0;
  const storeToo = sp.store === "1" ? " 책방도 함께 공개했어요." : "";
  if (sp.done === "approve") return `${n > 0 ? `모임 ${n}개를 공개했어요.` : ""}${storeToo}`.trim() || "공개했어요.";
  if (sp.done === "reject") return `모임 ${n}개를 대기함에서 뺐어요. 숨긴 채로 남아 있어요.`;
  if (sp.done === "store") return "책방을 공개했어요. 모임은 따로 승인해 주세요.";
  if (sp.done === "ex-approve") return "전시를 공개했어요. 전시 메뉴와 책방 화면에 보여요.";
  if (sp.done === "ex-reject") return "전시를 대기함에서 뺐어요. 숨긴 채로 남아 있어요.";
  if (sp.done === "ex-poster") return "포스터를 올렸어요. 아직 공개 전이에요.";
  if (sp.done === "ex-poster-replace") return "포스터를 바꿨어요. 아직 공개 전이에요.";
  if (sp.done === "edit") return "모임 내용을 고쳤어요. 아직 공개 전이에요.";
  if (sp.done === "store-edit") return "책방 정보를 고쳤어요. 아직 공개 전이에요.";
  return undefined;
}

function errorMessage(sp: Record<string, string | string[] | undefined>): string | undefined {
  const map: Record<string, string> = {
    nolink: "신청 링크가 비어 있어서 승인하지 않았어요. [내용 고치기]에서 신청 링크를 먼저 채워 주세요.",
    "nolink-all": "신청 링크가 빈 모임이 있어서 모두 승인하지 않았어요. 빈 모임의 신청 링크를 먼저 채워 주세요.",
    date: "날짜와 시작 시각을 확인해 주세요.",
    ends: "끝나는 시각은 시작 시각보다 늦어야 해요(같은 날 '21:00'처럼).",
    title: "모임 이름을 적어 주세요.",
    apply: "신청 링크는 https:// 로 시작하는 주소나 sms:01012345678 처럼 적어 주세요.",
    post: "게시물 링크는 https:// 로 시작하는 주소로 적어 주세요.",
    name: "책방 이름을 적어 주세요.",
    insta: "인스타그램은 https:// 로 시작하는 주소로 적어 주세요.",
    "ex-permission": "포스터가 있는 전시는 '책방에 포스터 사용 허가를 받았어요'에 표시해야 공개할 수 있어요.",
    "ex-store": "이 책방이 아직 공개 전이에요. 위에서 책방(또는 모임)을 먼저 승인해 주세요.",
  };
  return typeof sp.error === "string" ? map[sp.error] : undefined;
}

// 같은 묶음(한 번에 신청하는 회차들)은 카드 한 장으로 보여 주고 함께 승인한다
function oneCardPerSeries(meetings: PendingMeeting[]): PendingMeeting[] {
  const seen = new Set<string>();
  return meetings.filter((m) => {
    if (!m.series || !m.seriesKey) return true;
    if (seen.has(m.seriesKey)) return false;
    seen.add(m.seriesKey);
    return true;
  });
}

function StoreGroup({ group: g, now }: { group: ReviewGroup; now: Date }) {
  const cards = oneCardPerSeries(g.meetings);
  const headingId = `store-${g.storeId}`;
  return (
    <li aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
        <h2 id={headingId} className="text-t1 text-ink">
          {g.storeName} <span className="text-l1 font-normal text-ink-3">· {g.region}</span>
          {g.store && <StatusBadge tone="info" className="ml-1.5 align-middle">새 책방</StatusBadge>}
        </h2>
        {g.meetings.length > 1 && (
          <div className="flex items-center gap-3">
            <form action={rejectStoreAll}>
              <input type="hidden" name="storeId" value={g.storeId} />
              <SubmitButton
                pendingText="빼는 중…"
                confirm={`${g.storeName} 모임 ${g.meetings.length}개를 모두 넣지 않을까요? 대기함에서 빠지고, 사이트에는 올라가지 않아요(지우지는 않아요).`}
                className="inline-flex min-h-11 items-center px-1 text-l1 font-semibold text-ink-2 underline underline-offset-2"
              >
                모두 넣지 않음
              </SubmitButton>
            </form>
            <form action={approveStoreAll}>
              <input type="hidden" name="storeId" value={g.storeId} />
              <SubmitButton
                pendingText="공개하는 중…"
                confirm={`${g.storeName} 모임 ${g.meetings.length}개를 모두 승인할까요? 바로 사이트에 올라가요.${g.store ? " 책방도 함께 공개돼요." : ""}`}
                className="inline-flex min-h-11 items-center px-1 text-l1 font-semibold text-navy underline underline-offset-2"
              >
                모두 승인 ({g.meetings.length}개)
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      {g.store && <StoreBox store={g.store} hasMeetings={g.meetings.length > 0} />}

      {cards.length > 0 ? (
        <ul className="mt-4 space-y-5">
          {cards.map((m) => (
            <MeetingItem key={m.id} m={m} sessions={m.seriesKey && m.series ? g.meetings.filter((x) => x.seriesKey === m.seriesKey) : [m]} now={now} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-b2 text-ink-3">이 책방은 대기 중인 모임이 없어요. 책방 정보만 확인해 주세요.</p>
      )}
    </li>
  );
}

function StoreBox({ store: s, hasMeetings }: { store: PendingStore; hasMeetings: boolean }) {
  const rows: [string, string | null][] = [
    ["주소", s.address],
    ["운영시간", s.hours],
    ["대표번호", s.phone],
    ["인스타", s.instagramUrl],
    ["소개", s.intro],
  ];
  return (
    <div id={`s-${s.id}`} className="mt-3 scroll-mt-4 rounded-md border border-border-card bg-card p-4">
      <p className="text-l1 font-semibold text-ink">책방 정보</p>
      {s.note && <Note text={s.note} />}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-b2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className={`whitespace-pre-line break-words ${v ? "text-ink" : "text-ink-3"}`}>{v ?? "없음"}</dd>
          </div>
        ))}
      </dl>
      <StoreEdit store={s} />
      <p className="mt-3 text-l2 font-normal text-ink-3">
        {hasMeetings ? "모임을 승인하면 책방도 함께 공개돼요." : "모임 없이 책방만 올릴 때 눌러 주세요."}
      </p>
      <form action={approveStore} className="mt-1">
        <input type="hidden" name="storeId" value={s.id} />
        <SubmitButton pendingText="공개하는 중…" className="min-h-11 w-full rounded-sm border border-border-strong bg-card py-2.5 text-l1 font-semibold text-navy hover:bg-sub">
          책방만 승인
        </SubmitButton>
      </form>
    </div>
  );
}

function MeetingItem({ m, sessions, now }: { m: PendingMeeting; sessions: PendingMeeting[]; now: Date }) {
  const count = m.series?.sessions.length ?? 1;
  const sms = smsNumber(m.applyUrl);
  const noLink = sessions.some((x) => !x.applyUrl.trim());
  const applyText =
    m.applyMethod === "none" ? "신청 없이 자유 방문" : m.applyMethod === "dm" ? "인스타 DM" : sms ? `문자 (${sms})` : "신청서·예약 페이지";
  return (
    <li id={`m-${m.id}`} className="scroll-mt-4">
      <MeetingCard meeting={m} now={now} href={`/admin/review/${m.id}`} />
      <div className="mt-2 rounded-md bg-sub px-3 py-2.5">
        {m.note && <Note text={m.note} />}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-l2 font-normal">
          <dt className="text-ink-3">신청</dt>
          <dd className="break-all text-ink-2">
            {!m.applyUrl.trim() ? (
              <strong className="text-error">신청 링크 없음</strong>
            ) : (
              <>
                {applyText}
                {m.applyMethod !== "none" && !sms && (
                  <>
                    {" · "}
                    <ExternalLink href={m.applyUrl} />
                  </>
                )}
              </>
            )}
          </dd>
          <dt className="text-ink-3">게시물</dt>
          <dd className="break-all text-ink-2">{m.postUrlRaw ? <ExternalLink href={m.postUrlRaw} /> : "없음"}</dd>
          <dt className="text-ink-3">참가비</dt>
          <dd className="text-ink-2">{m.feeText ?? "없음"}</dd>
          <dt className="text-ink-3">장소</dt>
          <dd className="text-ink-2">{m.place ?? "책방"}</dd>
        </dl>
        <Link href={`/admin/review/${m.id}`} className="mt-1 inline-flex min-h-11 items-center text-l1 font-semibold text-navy underline underline-offset-2">
          상세 화면 미리보기
        </Link>
        {sessions.map((x, i) => (
          <MeetingEdit key={x.id} m={x} label={sessions.length > 1 ? `${i + 1}회차 고치기 (${kstDate(x.startsAt)})` : "내용 고치기"} />
        ))}
        {noLink && <p className="mt-2 text-l2 font-normal text-error">신청 링크를 채워야 승인할 수 있어요.</p>}
        <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
          <form action={approveMeeting}>
            <input type="hidden" name="meetingId" value={m.id} />
            <SubmitButton pendingText="공개하는 중…" className="min-h-11 w-full rounded-sm bg-navy px-2 py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover">
              {count > 1 ? `승인 (${count}회 모두)` : "승인"}
            </SubmitButton>
          </form>
          <form action={rejectMeeting}>
            <input type="hidden" name="meetingId" value={m.id} />
            <SubmitButton
              pendingText="빼는 중…"
              confirm={`이 모임을 넣지 않을까요? 대기함에서 빠지고, 사이트에는 올라가지 않아요(지우지는 않아요).`}
              className="min-h-11 w-full rounded-sm border border-border bg-card px-2 py-2.5 text-l1 font-semibold text-ink-2 hover:bg-sub"
            >
              넣지 않음
            </SubmitButton>
          </form>
        </div>
      </div>
    </li>
  );
}

// 승인 전 모임 고치기. 저장해도 공개되지 않고, 고친 모습은 위 카드에 바로 보인다
function MeetingEdit({ m, label }: { m: PendingMeeting; label: string }) {
  const f = (k: string) => `${k}-${m.id}`;
  return (
    <EditBox label={label}>
      <form action={editPendingMeeting} className="space-y-3">
        <input type="hidden" name="meetingId" value={m.id} />
        <Field label="모임 이름" htmlFor={f("title")} hint="가운뎃점(·)은 ~로 바꿔서 저장해요">
          <input id={f("title")} name="title" required maxLength={100} defaultValue={m.title} className={inputClass} />
        </Field>
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <Field label="날짜·시작" htmlFor={f("starts")}>
            <input id={f("starts")} name="startsAt" type="datetime-local" required defaultValue={toKstInput(m.startsAt)} className={inputClass} />
          </Field>
          <Field label="끝나는 시각" htmlFor={f("ends")}>
            <input id={f("ends")} name="endsAt" type="time" defaultValue={m.endsAt ? toKstInput(m.endsAt).slice(11) : ""} className={inputClass} />
          </Field>
        </div>
        <Field label="시간 안내 (반마다 시간이 다를 때만)" htmlFor={f("timeNote")} hint="예: (8세) 오후 3:50 / (7세) 오후 5:00">
          <input id={f("timeNote")} name="timeNote" maxLength={60} defaultValue={m.timeNote ?? ""} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="책 제목" htmlFor={f("book")}>
            <input id={f("book")} name="bookTitle" maxLength={200} defaultValue={m.bookTitle ?? ""} className={inputClass} />
          </Field>
          <Field label="저자" htmlFor={f("author")}>
            <input id={f("author")} name="bookAuthor" maxLength={100} defaultValue={m.bookAuthor ?? ""} className={inputClass} />
          </Field>
        </div>
        <ArtPicker m={m} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="장르" htmlFor={f("genre")}>
            <Select id={f("genre")} name="genre" value={m.tagGenre} options={GENRES} />
          </Field>
          <Field label="모임방식" htmlFor={f("format")}>
            <Select id={f("format")} name="format" value={m.tagFormat} options={FORMATS} />
          </Field>
          <Field label="정기/일일" htmlFor={f("cadence")}>
            <Select id={f("cadence")} name="cadence" value={m.tagCadence} options={["정기", "일일"]} />
          </Field>
          <Field label="모집 상태" htmlFor={f("status")}>
            <Select id={f("status")} name="status" value={m.status} options={[["open", "모집중"], ["closed", "마감"]]} />
          </Field>
        </div>
        <Field label="신청 방식" htmlFor={f("method")}>
          <Select
            id={f("method")}
            name="applyMethod"
            value={m.applyMethod}
            options={[["form", "신청서·예약 페이지·문자"], ["dm", "인스타 DM (링크에 책방 인스타)"], ["none", "신청 없이 자유 방문 (링크에 게시물)"]]}
          />
        </Field>
        <Field label="신청 링크" htmlFor={f("apply")} hint="https:// 주소, 문자 신청이면 sms:01012345678. 비어 있으면 승인할 수 없어요">
          <input id={f("apply")} name="applyUrl" maxLength={500} defaultValue={m.applyUrl} className={inputClass} />
        </Field>
        <Field label="게시물 링크" htmlFor={f("post")}>
          <input id={f("post")} name="postUrl" type="url" maxLength={500} defaultValue={m.postUrlRaw ?? ""} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="참가비" htmlFor={f("fee")}>
            <input id={f("fee")} name="feeText" maxLength={100} defaultValue={m.feeText ?? ""} placeholder="예: 2만원(음료 포함)" className={inputClass} />
          </Field>
          <Field label="장소 설명" htmlFor={f("place")}>
            <input id={f("place")} name="place" maxLength={200} defaultValue={m.place ?? ""} placeholder="비우면 책방" className={inputClass} />
          </Field>
        </div>
        <Field label="모임 소개" htmlFor={f("desc")}>
          <textarea id={f("desc")} name="description" rows={6} maxLength={1000} defaultValue={m.description ?? ""} className={textareaClass} />
        </Field>
        <Field label="확인할 점 (손님에게 안 보여요)" htmlFor={f("note")} hint="확인이 끝난 줄은 지워 주세요">
          <textarea id={f("note")} name="note" rows={3} maxLength={1000} defaultValue={m.note ?? ""} className={textareaClass} />
        </Field>
        <SubmitButton pendingText="저장하는 중…" className="min-h-11 w-full rounded-sm bg-navy py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover">
          고친 내용 저장 (공개는 안 돼요)
        </SubmitButton>
      </form>
    </EditBox>
  );
}

// 표지 그림 고르기: 그림을 눌러 고른다(라디오 버튼). '자동'은 책 표지, 없으면 모임 종류에 맞춘 그림.
// 그림을 고르면 책 제목이 있어도 책 표지 대신 그 그림이 나온다
function ArtPicker({ m }: { m: PendingMeeting }) {
  const options = [["auto", m.bookTitle ? "자동(책 표지)" : "자동", m.bookTitle ? null : autoMeetingArt(m)] as const, ...MEETING_ARTS.map(([k, t]) => [k, t, k] as const)];
  return (
    <fieldset>
      <legend className="text-l2 font-semibold text-ink">표지 그림</legend>
      <div className="mt-1 grid grid-cols-5 gap-1.5">
        {options.map(([value, label, art]) => (
          <label key={value} className="cursor-pointer text-center">
            <input type="radio" name="coverArt" value={value} defaultChecked={(m.coverArt ?? "auto") === value} className="peer sr-only" />
            <span className="relative block aspect-[2/3] overflow-hidden rounded-xs bg-cream ring-1 ring-border peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:outline-2 peer-focus-visible:outline-navy">
              {art ? (
                <img src={meetingArtSrc(art)} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-l2 font-normal text-ink-3">책 표지</span>
              )}
            </span>
            <span className="mt-1 block text-l2 font-normal leading-tight text-ink-2 peer-checked:font-semibold peer-checked:text-navy">{label}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-l2 font-normal text-ink-3">그림을 고르면 책 제목이 있어도 책 표지 대신 그 그림이 나와요</p>
    </fieldset>
  );
}

const REGION_OPTIONS = SIDOS.flatMap((sido) => REGIONS[sido].map((gu) => `${sido} ${gu}`));

function StoreEdit({ store: s }: { store: PendingStore }) {
  const f = (k: string) => `${k}-s${s.id}`;
  return (
    <EditBox label="책방 정보 고치기">
      <form action={editPendingStore} className="space-y-3">
        <input type="hidden" name="storeId" value={s.id} />
        <Field label="책방 이름" htmlFor={f("name")}>
          <input id={f("name")} name="name" required maxLength={60} defaultValue={s.name} className={inputClass} />
        </Field>
        <Field label="지역" htmlFor={f("region")}>
          <Select id={f("region")} name="region" value={s.region} options={REGION_OPTIONS} />
        </Field>
        <Field label="주소" htmlFor={f("address")}>
          <input id={f("address")} name="address" maxLength={200} defaultValue={s.address ?? ""} className={inputClass} />
        </Field>
        <Field label="운영시간" htmlFor={f("hours")} hint="줄을 바꿔 여러 줄로 적을 수 있어요">
          <textarea id={f("hours")} name="hours" rows={3} maxLength={300} defaultValue={s.hours ?? ""} className={textareaClass} />
        </Field>
        <Field label="대표번호" htmlFor={f("phone")}>
          <input id={f("phone")} name="phone" maxLength={30} defaultValue={s.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="인스타그램" htmlFor={f("insta")}>
          <input id={f("insta")} name="instagramUrl" type="url" maxLength={300} defaultValue={s.instagramUrl ?? ""} className={inputClass} />
        </Field>
        <Field label="소개" htmlFor={f("intro")}>
          <textarea id={f("intro")} name="intro" rows={4} maxLength={1000} defaultValue={s.intro ?? ""} className={textareaClass} />
        </Field>
        <Field label="확인할 점 (손님에게 안 보여요)" htmlFor={f("note")} hint="확인이 끝난 줄은 지워 주세요">
          <textarea id={f("note")} name="note" rows={3} maxLength={1000} defaultValue={s.note ?? ""} className={textareaClass} />
        </Field>
        <SubmitButton pendingText="저장하는 중…" className="min-h-11 w-full rounded-sm bg-navy py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover">
          고친 내용 저장 (공개는 안 돼요)
        </SubmitButton>
      </form>
    </EditBox>
  );
}

function EditBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2 rounded-sm border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-l1 font-semibold text-navy [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-3 pt-3 pb-3">{children}</div>
    </details>
  );
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xs border border-border-control bg-card px-3 text-b2 text-ink focus:border-navy focus:outline-2 focus:outline-navy";
const textareaClass =
  "mt-1 block w-full rounded-xs border border-border-control bg-card px-3 py-2 text-b2 text-ink focus:border-navy focus:outline-2 focus:outline-navy";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-l2 font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-l2 font-normal text-ink-3">{hint}</p>}
    </div>
  );
}

// 목록에 없는 값(예전 값)이 들어 있어도 지워지지 않게 맨 위에 그대로 둔다
function Select({ id, name, value, options }: { id: string; name: string; value: string; options: readonly (string | readonly [string, string])[] }) {
  const list = options.map((o) => (typeof o === "string" ? ([o, o] as const) : o));
  const known = list.some(([v]) => v === value);
  return (
    <select id={id} name={name} defaultValue={value} className={inputClass}>
      {!known && <option value={value}>{value} (목록에 없음)</option>}
      {list.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

// <input type="datetime-local"> 에 넣을 한국 시간 '2026-10-08T19:30'
function toKstInput(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
}

function kstDate(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
}

// Claude가 적어 둔 '확인할 점'. 줄마다 하나씩
// 전시 한 건: 손님에게 보일 카드 → 확인할 정보 → 포스터 올리기 → 넣지 않음 / 승인(포스터가 있으면 허가 확인 칸)
function ExhibitionItem({ e, now }: { e: PendingExhibition; now: Date }) {
  const rows: [string, string | null][] = [
    ["종류", KIND_LABEL[e.kind]],
    ["기간", `${e.startsOn} ~ ${e.endsOn}`],
    ["시간", e.hoursNote ?? "책방 운영시간"],
    ["입장료", e.isPaid ? `유료${e.feeNote ? ` ${e.feeNote}` : ""}` : "무료(표시 안 함)"],
    ["소개", e.intro],
  ];
  return (
    <li id={`e-${e.id}`} className="scroll-mt-4">
      <ExhibitionCard exhibition={e} now={now} href={`#e-${e.id}`} />
      <div className="mt-2 rounded-md bg-sub px-3 py-2.5">
        {e.note && <Note text={e.note} />}
        {e.storeBlocked && (
          <p className="mb-2 text-l2 font-semibold text-error">이 책방은 아직 공개 전이에요. 책방(모임)을 먼저 승인해야 전시를 공개할 수 있어요.</p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-l2 font-normal">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className={`whitespace-pre-line break-words ${v ? "text-ink-2" : "text-ink-3"}`}>{v ?? "없음"}</dd>
            </div>
          ))}
          <dt className="text-ink-3">게시물</dt>
          <dd className="break-all text-ink-2">{e.postUrl ? <ExternalLink href={e.postUrl} /> : "없음"}</dd>
        </dl>
        <PosterUploadForm exhibitionId={e.id} hasPoster={Boolean(e.poster)} />
        {/* 승인 폼은 칸 배치만 grid 에 맡긴다(contents): 허가 확인 줄은 위에 꽉 차게, 승인 버튼은 넣지 않음 옆에 */}
        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
          <form action={approveExhibition} className="contents">
            <input type="hidden" name="exhibitionId" value={e.id} />
            {e.poster ? (
              <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-b2 text-ink">
                <input type="checkbox" name="permission" value="yes" required className="size-5 accent-navy" />
                책방에 포스터 사용 허가를 받았어요
              </label>
            ) : (
              <p className="col-span-2 text-l2 font-normal text-ink-3">포스터 없이 올리면 카드에 전시 종류만 보여요.</p>
            )}
            <SubmitButton pendingText="공개하는 중…" className="min-h-11 w-full rounded-sm bg-navy px-2 py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover">
              승인
            </SubmitButton>
          </form>
          <form action={rejectExhibition}>
            <input type="hidden" name="exhibitionId" value={e.id} />
            <SubmitButton
              pendingText="빼는 중…"
              confirm="이 전시를 넣지 않을까요? 대기함에서 빠지고, 사이트에는 올라가지 않아요(지우지는 않아요)."
              className="min-h-11 w-full rounded-sm border border-border bg-card px-2 py-2.5 text-l1 font-semibold text-ink-2 hover:bg-sub"
            >
              넣지 않음
            </SubmitButton>
          </form>
        </div>
      </div>
    </li>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div className="mb-2 rounded-xs border border-warning-border bg-warning-surface px-3 py-2">
      <p className="text-l2 font-semibold text-ink">확인할 점</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-l2 font-normal text-ink">
        {text
          .split(/\n| \/ /)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t, i) => (
            <li key={i}>{t}</li>
          ))}
      </ul>
    </div>
  );
}

function ExternalLink({ href }: { href: string }) {
  const safe = /^https?:\/\//i.test(href);
  if (!safe) return <span className="select-all">{href}</span>;
  let label = href;
  try {
    const u = new URL(href);
    label = `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname.slice(0, 24) + (u.pathname.length > 24 ? "…" : "") : ""}`;
  } catch {}
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-navy underline underline-offset-2">
      {label} ↗
    </a>
  );
}
