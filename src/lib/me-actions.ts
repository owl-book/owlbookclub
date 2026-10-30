"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AUTH_COOKIE, safeNext, signValue, verifyValue } from "@/lib/auth-shared";
import { LOGIN_COOKIE_OPTIONS, getCurrentUser, isAuthEnabled, signOutIfGone } from "@/lib/auth";
import { getMeetingForRecord, isWishKind, savePlan, saveWish, type WishKind } from "@/lib/me";
import { isPast } from "@/lib/meetings";
import { logEvent } from "@/lib/tracking";
import { kakaoAdminKey, unlinkKakaoOrQueue } from "@/lib/kakao-unlink";

// 마이페이지 저장 동작. 화면 밖에서 직접 호출될 수도 있으므로 매번 로그인 본인인지 확인하고,
// 쓰기·지우기는 항상 user_id = 본인 조건을 붙인다.

async function requireUser() {
  if (!isAuthEnabled()) throw new Error("로그인 기능이 꺼져 있습니다.");
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  await signOutIfGone(user);
  return user;
}

function toId(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// 찜 켜기·끄기. 성공하면 최종 상태를 돌려준다(하트 버튼이 바로 반영).
export async function setWish(kind: WishKind, rawId: number, on: boolean): Promise<boolean> {
  const user = await requireUser();
  const id = toId(rawId);
  if (!id || !isWishKind(kind)) throw new Error("잘못된 요청입니다.");
  await saveWish(user.id, kind, id, on);
  // 목록·상세·마이페이지에 보이는 하트를 모두 새로 그리도록
  revalidatePath("/", "layout");
  return on;
}

// '책방에서 신청했어요' 표시·취소. 신청 자체는 책방에서 하고, 여기서는 본인 일정에 담기만 한다.
// 이미 지난 모임은 신청 표시 대신 '다녀왔어요'를 쓴다.
export async function setApplied(rawId: number, on: boolean): Promise<boolean> {
  const user = await requireUser();
  const id = toId(rawId);
  if (!id) throw new Error("잘못된 요청입니다.");
  if (on) {
    const meeting = await getMeetingForRecord(id);
    if (!meeting || meeting.hidden || isPast(meeting)) throw new Error("신청 표시를 할 수 없는 모임입니다.");
  }
  await savePlan(user.id, id, { apply: on });
  revalidatePath("/", "layout");
  return on;
}

// 모임 뒤 확인: 다녀왔어요 / 못 갔어요 / 되돌리기(clear → 다시 '다녀오셨나요?'로)
export async function setAttended(formData: FormData) {
  const user = await requireUser();
  const meetingId = toId(formData.get("meetingId"));
  const value = formData.get("attended");
  if (!meetingId || (value !== "yes" && value !== "no" && value !== "clear")) throw new Error("잘못된 요청입니다.");
  const meeting = await getMeetingForRecord(meetingId);
  if (!meeting || !isPast(meeting)) redirect("/me?tab=mine");
  await savePlan(user.id, meetingId, { attended: value === "clear" ? null : value });
  revalidatePath("/", "layout");
  redirect(value === "yes" ? `/me?tab=mine&attended=${meetingId}` : value === "no" ? `/me?tab=mine&missed=${meetingId}` : "/me?tab=mine&cleared=1");
}

function clean(v: FormDataEntryValue | null, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n").trim().slice(0, max);
  return s || null;
}

// 기록 저장·삭제는 글을 오래 쓴 뒤 누르는 경우가 많다. 그사이 로그인이 풀렸으면 오류 화면 대신
// 로그인 화면으로 보낸다(쓰던 글은 기록 화면이 이 기기에 보관해 두어 다시 로그인하면 되살아난다)
async function requireUserForRecord(meetingId: number) {
  if (isAuthEnabled() && !(await getCurrentUser())) {
    redirect(`/login?error=record&next=${encodeURIComponent(`/me/records/${meetingId}`)}`);
  }
  return requireUser();
}

export async function saveRecord(formData: FormData) {
  const meetingId = toId(formData.get("meetingId"));
  if (!meetingId) throw new Error("잘못된 요청입니다.");
  const user = await requireUserForRecord(meetingId);
  const meeting = await getMeetingForRecord(meetingId);
  // 다녀온 모임만 기록할 수 있다
  if (!meeting || !isPast(meeting)) redirect(`/me/records/${meetingId}`);

  const ratingNum = Number(formData.get("rating"));
  const rating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null;
  const quote = clean(formData.get("quote"), 500);
  const memo = clean(formData.get("memo"), 5000);

  const { error } = await db()
    .from("meeting_records")
    .upsert(
      { user_id: user.id, meeting_id: meetingId, rating, quote, memo, updated_at: new Date().toISOString() },
      { onConflict: "user_id,meeting_id" },
    );
  if (error) throw new Error(`기록 저장 실패: ${error.message}`);
  // 내용은 남기지 않고 '기록했다'는 사실만 센다
  await logEvent({ type: "record", userId: user.id, meetingId, storeId: meeting.store.id, props: { action: "save" } });

  revalidatePath("/", "layout");
  redirect(`/me?tab=mine&saved=${meetingId}`);
}

export async function deleteRecord(formData: FormData) {
  const meetingId = toId(formData.get("meetingId"));
  if (!meetingId) throw new Error("잘못된 요청입니다.");
  const user = await requireUserForRecord(meetingId);
  const { error } = await db().from("meeting_records").delete().eq("user_id", user.id).eq("meeting_id", meetingId);
  if (error) throw new Error(`기록 삭제 실패: ${error.message}`);
  revalidatePath("/", "layout");
  redirect(`/me?tab=mine&deleted=${meetingId}`);
}

export async function updateDisplayName(formData: FormData) {
  const user = await requireUser();
  const name = clean(formData.get("displayName"), 20)?.replace(/\s+/g, " ") ?? null;
  const { data, error } = await db()
    .from("users")
    .update({ display_name: name })
    .eq("id", user.id)
    .select("nickname, provider")
    .maybeSingle();
  if (error) throw new Error(`별명 저장 실패: ${error.message}`);
  if (!data) redirect("/login?next=/me");

  // 헤더에 보이는 이름은 로그인 쿠키에 들어 있으므로 새 이름으로 다시 서명한다.
  // 남은 로그인 기간은 그대로 둔다(브라우저 24시간을 늘리지도, 홈 화면 앱의 1년을 줄이지도 않게)
  const shown = name || data.nickname?.slice(0, 20) || "회원";
  const store = await cookies();
  const current = await verifyValue<{ exp: number }>(store.get(AUTH_COOKIE.user)?.value);
  const left = current ? current.exp - Math.floor(Date.now() / 1000) : 0;
  if (left <= 0) redirect("/login?next=/me");
  store.set(AUTH_COOKIE.user, await signValue({ id: user.id, name: shown, provider: user.provider, v: user.v }, left), { ...LOGIN_COOKIE_OPTIONS, maxAge: left });
  revalidatePath("/", "layout");
  // 가입 직후 환영 화면에서 저장했으면 원래 보던 페이지로 돌려보낸다
  const next = formData.get("next");
  redirect(typeof next === "string" ? safeNext(next) : "/me?updated=1");
}

// 다른 기기 모두 로그아웃: 출입증 버전을 1 올린다 → 다른 기기의 예전 쿠키는 저장·마이페이지·앱 열기 때 풀린다.
// 지금 이 기기는 새 버전으로 다시 서명해 로그인을 유지한다(남은 로그인 기간은 그대로)
export async function signOutOtherDevices() {
  const user = await requireUser();
  const store = await cookies();
  const current = await verifyValue<{ exp: number }>(store.get(AUTH_COOKIE.user)?.value);
  const left = current ? current.exp - Math.floor(Date.now() / 1000) : 0;
  if (left <= 0) redirect("/login?next=/me/account");

  const next = user.v + 1;
  // 같은 순간 다른 기기에서도 눌렀다면 둘 중 하나만 반영된다(지금 버전일 때만 올림)
  const { data, error } = await db()
    .from("users")
    .update({ session_version: next })
    .eq("id", user.id)
    .eq("session_version", user.v)
    .select("id")
    .maybeSingle();
  if (error) {
    // 0033 설정문 실행 전: 칸이 없어 쓸 수 없다
    console.error("[owl] sign out others failed", error.message);
    redirect("/me/account?others=unavailable");
  }
  if (!data) redirect("/me/account?others=retry");

  store.set(AUTH_COOKIE.user, await signValue({ id: user.id, name: user.name, provider: user.provider, v: next }, left), { ...LOGIN_COOKIE_OPTIONS, maxAge: left });
  redirect("/me/account?others=done");
}

// 회원 탈퇴: 회원 정보를 지우면 찜·기록도 함께 지워진다(설정문의 on delete cascade).
// 이용 기록(events)의 회원 번호는 이제 누구인지 알 수 없는 값이 되어 1년 보관 후 파기한다.
// 카카오 회원은 카카오와의 연결도 끊는다(실패해도 탈퇴는 끝내고 매일 정리에서 다시 시도).
// 네이버·구글은 끊으려면 그 회원의 로그인 증표가 필요한데 저장하지 않으므로, 탈퇴 뒤 화면에서 직접 끊는 방법을 안내한다.
export async function withdraw(formData: FormData) {
  const user = await requireUser();
  if (formData.get("confirm") !== "yes") redirect("/me/account/withdraw?error=confirm");
  const { data: removed, error } = await db().from("users").delete().eq("id", user.id).select("provider, provider_user_id").maybeSingle();
  if (error) throw new Error(`탈퇴 처리 실패: ${error.message}`);
  if (removed?.provider === "kakao") await unlinkKakaoOrQueue(removed.provider_user_id);
  const store = await cookies();
  store.set(AUTH_COOKIE.user, "", { path: "/", maxAge: 0 });
  store.set(AUTH_COOKIE.lastProvider, "", { path: "/", maxAge: 0 });
  revalidatePath("/", "layout");
  // 탈퇴 뒤 홈 안내: 카카오는 연결도 끊었다고(Admin 키가 있을 때만), 네이버·구글은 직접 끊는 방법을 알려 준다
  const bye = removed?.provider === "kakao" ? (kakaoAdminKey() ? "kakao" : "1") : (removed?.provider ?? "1");
  redirect(`/?bye=${bye}`);
}
