import { MeetingPhotoTile } from "@/components/MeetingPhotoTile";
import { BulkEditForm } from "@/components/BulkEditForm";
import { EditForm } from "@/components/EditForm";
import { editPendingExhibition } from "@/lib/exhibition-actions";
import { EXHIBITION_KINDS, KIND_LABEL } from "@/lib/exhibitions";
import { autoMeetingArt, MEETING_ARTS, meetingArtSrc } from "@/lib/meeting-art";
import type { PendingExhibition, PendingMeeting, PendingStore } from "@/lib/review";
import { approveMeetings, bulkEditPendingMeetings, editPendingMeeting, editPendingStore } from "@/lib/review-actions";
import { REGIONS, SIDOS } from "@/lib/regions";
import { FORMATS, GENRES } from "@/lib/tags";
import { formatKstDateOnly } from "@/lib/time";

// 승인 화면의 '고치기' 폼 본문. 처음 화면에는 넣지 않고, 칸을 펼칠 때 서버에서 하나씩 받아 온다(LazyEditBox → loadEditForm)

// 승인 전 모임 고치기. 저장해도 공개되지 않고, 고친 모습은 위 카드에 바로 보인다
export function MeetingEditForm({ m }: { m: PendingMeeting }) {
  const f = (k: string) => `${k}-${m.id}`;
  return (
      <EditForm action={editPendingMeeting} doneHref={`/admin/review?done=edit#m-${m.id}`}>
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
      </EditForm>
  );
}

// 칸마다 처음 값은 첫 모임의 값. 바꾼 칸만 고른 모임 모두에 들어간다(BulkEditForm)
export function BulkMeetingEditForm({ meetings, anchor, series }: { meetings: PendingMeeting[]; anchor: string; series?: boolean }) {
  const m = meetings[0];
  const f = (k: string) => `${k}-b${m.id}`;
  return (
    <BulkEditForm
      save={bulkEditPendingMeetings}
      approve={approveMeetings}
      anchor={anchor}
      series={series}
      sessions={meetings.map((x) => ({ id: x.id, label: formatKstDateOnly(x.startsAt) }))}
    >
      <p className="rounded-xs border border-info-border bg-info-surface px-3 py-2 text-l2 font-normal text-ink">
        여기서 <strong className="font-semibold">바꾼 칸만</strong> 아래에서 고른 {series ? "회차" : "모임"} 모두에 똑같이 들어가요. 손대지 않은 칸은 {series ? "회차" : "모임"}마다 원래 값 그대로예요. 날짜는 바뀌지 않아요.
      </p>
      <Field label="모임 이름" htmlFor={f("title")} hint="가운뎃점(·)은 ~로 바꿔서 저장해요" mark>
        <input id={f("title")} name="title" required maxLength={100} defaultValue={m.title} className={bulkInputClass} />
      </Field>
      <div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="시작 시각" htmlFor={f("start")} mark>
            <input id={f("start")} name="startTime" type="time" required defaultValue={toKstInput(m.startsAt).slice(11)} className={bulkInputClass} />
          </Field>
          <Field label="끝나는 시각" htmlFor={f("end")} mark>
            <input id={f("end")} name="endTime" type="time" defaultValue={m.endsAt ? toKstInput(m.endsAt).slice(11) : ""} className={bulkInputClass} />
          </Field>
        </div>
        <p className="mt-1 text-l2 font-normal text-ink-3">날짜는 모임마다 그대로, 시각만 바뀌어요</p>
      </div>
      <Field label="시간 안내 (반마다 시간이 다를 때만)" htmlFor={f("timeNote")} hint="예: (8세) 오후 3:50 / (7세) 오후 5:00" mark>
        <input id={f("timeNote")} name="timeNote" maxLength={60} defaultValue={m.timeNote ?? ""} className={bulkInputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="책 제목" htmlFor={f("book")} mark>
          <input id={f("book")} name="bookTitle" maxLength={200} defaultValue={m.bookTitle ?? ""} className={bulkInputClass} />
        </Field>
        <Field label="저자" htmlFor={f("author")} mark>
          <input id={f("author")} name="bookAuthor" maxLength={100} defaultValue={m.bookAuthor ?? ""} className={bulkInputClass} />
        </Field>
      </div>
      <ArtPicker m={m} bulk />
      <div className="grid grid-cols-2 gap-2">
        <Field label="장르" htmlFor={f("genre")} mark>
          <Select id={f("genre")} name="genre" value={m.tagGenre} options={GENRES} className={bulkInputClass} />
        </Field>
        <Field label="모임방식" htmlFor={f("format")} mark>
          <Select id={f("format")} name="format" value={m.tagFormat} options={FORMATS} className={bulkInputClass} />
        </Field>
        <Field label="정기/일일" htmlFor={f("cadence")} mark>
          <Select id={f("cadence")} name="cadence" value={m.tagCadence} options={["정기", "일일"]} className={bulkInputClass} />
        </Field>
        <Field label="모집 상태" htmlFor={f("status")} mark>
          <Select id={f("status")} name="status" value={m.status} options={[["open", "모집중"], ["closed", "마감"]]} className={bulkInputClass} />
        </Field>
      </div>
      <Field label="신청 방식" htmlFor={f("method")} mark>
        <Select
          id={f("method")}
          name="applyMethod"
          value={m.applyMethod}
          options={[["form", "신청서·예약 페이지·문자"], ["dm", "인스타 DM (링크에 책방 인스타)"], ["none", "신청 없이 자유 방문 (링크에 게시물)"]]}
          className={bulkInputClass}
        />
      </Field>
      <Field label="신청 링크" htmlFor={f("apply")} hint="https:// 주소, 문자 신청이면 sms:01012345678" mark>
        <input id={f("apply")} name="applyUrl" maxLength={500} defaultValue={m.applyUrl} className={bulkInputClass} />
      </Field>
      <Field label="게시물 링크" htmlFor={f("post")} mark>
        <input id={f("post")} name="postUrl" type="url" maxLength={500} defaultValue={m.postUrlRaw ?? ""} className={bulkInputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="참가비" htmlFor={f("fee")} mark>
          <input id={f("fee")} name="feeText" maxLength={100} defaultValue={m.feeText ?? ""} placeholder="예: 2만원(음료 포함)" className={bulkInputClass} />
        </Field>
        <Field label="장소 설명" htmlFor={f("place")} mark>
          <input id={f("place")} name="place" maxLength={200} defaultValue={m.place ?? ""} placeholder="비우면 책방" className={bulkInputClass} />
        </Field>
      </div>
      <Field label="모임 소개" htmlFor={f("desc")} mark>
        <textarea id={f("desc")} name="description" rows={6} maxLength={1000} defaultValue={m.description ?? ""} className={bulkTextareaClass} />
      </Field>
    </BulkEditForm>
  );
}

// 표지 그림 고르기: 그림을 눌러 고른다(라디오 버튼). '자동'은 책 표지, 없으면 모임 종류에 맞춘 그림.
// 그림을 고르면 책 제목이 있어도 책 표지 대신 그 그림이 나온다. 맨 왼쪽은 대표 사진 칸(+ 를 눌러 사진 추가, 예: 영화 포스터)
function ArtPicker({ m, bulk }: { m: PendingMeeting; bulk?: boolean }) {
  const options = [["auto", m.bookTitle ? "자동(책 표지)" : "자동", m.bookTitle ? null : autoMeetingArt(m)] as const, ...MEETING_ARTS.map(([k, t]) => [k, t, k] as const)];
  // 사진이 있으면 사진이 가장 먼저 보이므로 사진 칸이 선택된 채로 연다
  const current = m.photoUrl ? "photo" : (m.coverArt ?? "auto");
  return (
    <fieldset data-field={bulk ? "" : undefined} className={bulk ? "group/f" : undefined}>
      <legend className="text-l2 font-semibold text-ink">
        표지 그림
        {bulk && <ChangedBadge />}
      </legend>
      {/* 휴대폰에서는 3칸씩 두 줄, 넓은 화면에서는 한 줄 */}
      <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <MeetingPhotoTile photoUrl={m.photoUrl} checked={current === "photo"} />
        {options.map(([value, label, art]) => (
          <label key={value} className="cursor-pointer text-center">
            <input type="radio" name="coverArt" value={value} defaultChecked={current === value} className="peer sr-only" />
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
      <p className="mt-1 text-l2 font-normal text-ink-3">
        그림을 고르면 책 제목이 있어도 책 표지 대신 그 그림이 나와요.{" "}
        {bulk ? "사진을 올리면 고른 모임 모두에 같은 사진이 들어가요" : "사진은 [고친 내용 저장]이나 [승인]을 눌러야 올라가요"}
      </p>
    </fieldset>
  );
}

const REGION_OPTIONS = SIDOS.flatMap((sido) => REGIONS[sido].map((gu) => `${sido} ${gu}`));

export function StoreEditForm({ store: s }: { store: PendingStore }) {
  const f = (k: string) => `${k}-s${s.id}`;
  return (
      <EditForm action={editPendingStore} doneHref={`/admin/review?done=store-edit#s-${s.id}`}>
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
      </EditForm>
  );
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xs border border-border-control bg-card px-3 text-b2 text-ink focus:border-navy focus:outline-2 focus:outline-navy";
// 한꺼번에 고치기에서 바꾼 칸은 테두리를 진하게
const CHANGED = " data-[changed]:border-navy data-[changed]:outline-2 data-[changed]:outline-navy";
const textareaClass =
  "mt-1 block w-full rounded-xs border border-border-control bg-card px-3 py-2 text-b2 text-ink focus:border-navy focus:outline-2 focus:outline-navy";
const bulkInputClass = inputClass + CHANGED;
const bulkTextareaClass = textareaClass + CHANGED;

// mark: 한꺼번에 고치기 칸. 칸을 바꾸면(BulkEditForm 이 data-changed 를 붙임) 이름 옆에 '바꿈'이 보인다
// 상태 뱃지(Tag.tsx StatusBadge info)와 같은 모양. 평소엔 숨어 있다가 칸을 바꾸면 보인다
function ChangedBadge() {
  return (
    <span className="ml-1.5 hidden whitespace-nowrap rounded-full bg-info-surface px-2 py-px align-middle text-l2 leading-4 font-semibold text-info group-data-[changed]/f:inline-block">
      바꿈
    </span>
  );
}

function Field({ label, htmlFor, hint, mark, children }: { label: string; htmlFor: string; hint?: string; mark?: boolean; children: React.ReactNode }) {
  return (
    <div data-field={mark ? "" : undefined} className={mark ? "group/f" : undefined}>
      <label htmlFor={htmlFor} className="text-l2 font-semibold text-ink">
        {label}
        {mark && <ChangedBadge />}
      </label>
      {children}
      {hint && <p className="mt-1 text-l2 font-normal text-ink-3">{hint}</p>}
    </div>
  );
}

// 목록에 없는 값(예전 값)이 들어 있어도 지워지지 않게 맨 위에 그대로 둔다
function Select({
  id,
  name,
  value,
  options,
  className = inputClass,
}: {
  id: string;
  name: string;
  value: string;
  options: readonly (string | readonly [string, string])[];
  className?: string;
}) {
  const list = options.map((o) => (typeof o === "string" ? ([o, o] as const) : o));
  const known = list.some(([v]) => v === value);
  return (
    <select id={id} name={name} defaultValue={value} className={className}>
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

// 승인 전 전시 고치기. 저장해도 공개되지 않고, 고친 모습은 위 카드와 미리보기에 바로 보인다
export function ExhibitionEditForm({ e }: { e: PendingExhibition }) {
  const f = (k: string) => `${k}-e${e.id}`;
  return (
      <EditForm action={editPendingExhibition} doneHref={`/admin/review?done=ex-edit#e-${e.id}`}>
        <input type="hidden" name="exhibitionId" value={e.id} />
        <Field label="전시 이름" htmlFor={f("title")}>
          <input id={f("title")} name="title" required maxLength={120} defaultValue={e.title} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="종류" htmlFor={f("kind")}>
            <Select id={f("kind")} name="kind" value={e.kind} options={EXHIBITION_KINDS.map((k) => [k, KIND_LABEL[k]] as const)} />
          </Field>
          <Field label="작가" htmlFor={f("artist")} hint="여럿이면 쉼표로">
            <input id={f("artist")} name="artist" maxLength={120} defaultValue={e.artist ?? ""} className={inputClass} />
          </Field>
          <Field label="시작일" htmlFor={f("starts")}>
            <input id={f("starts")} name="startsOn" type="date" required defaultValue={e.startsOn} className={inputClass} />
          </Field>
          <Field label="마지막 날" htmlFor={f("ends")}>
            <input id={f("ends")} name="endsOn" type="date" required defaultValue={e.endsOn} className={inputClass} />
          </Field>
        </div>
        <Field label="전시 시간 (책방 운영시간과 다를 때만)" htmlFor={f("hours")} hint="비우면 책방 운영시간이 보여요">
          <input id={f("hours")} name="hoursNote" maxLength={200} defaultValue={e.hoursNote ?? ""} placeholder="예: 주말만 오후 1시 ~ 6시" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="입장료" htmlFor={f("paid")}>
            <Select id={f("paid")} name="isPaid" value={e.isPaid ? "yes" : "no"} options={[["no", "무료 (표시 안 함)"], ["yes", "유료"]]} />
          </Field>
          <Field label="금액 (유료일 때)" htmlFor={f("fee")}>
            <input id={f("fee")} name="feeNote" maxLength={60} defaultValue={e.feeNote ?? ""} placeholder="예: 5,000원" className={inputClass} />
          </Field>
        </div>
        <Field label="게시물 링크" htmlFor={f("post")}>
          <input id={f("post")} name="postUrl" type="url" maxLength={500} defaultValue={e.postUrl ?? ""} className={inputClass} />
        </Field>
        <Field label="전시 소개" htmlFor={f("intro")}>
          <textarea id={f("intro")} name="intro" rows={6} maxLength={2000} defaultValue={e.intro ?? ""} className={textareaClass} />
        </Field>
        <Field label="확인할 점 (손님에게 안 보여요)" htmlFor={f("note")} hint="확인이 끝난 줄은 지워 주세요">
          <textarea id={f("note")} name="note" rows={3} maxLength={1000} defaultValue={e.note ?? ""} className={textareaClass} />
        </Field>
      </EditForm>
  );
}

