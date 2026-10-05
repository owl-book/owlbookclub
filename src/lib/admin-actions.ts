"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, checkPassword, isAdminEnabled, makeAdminToken, requireAdmin } from "@/lib/admin";
import { clientIpHash } from "@/lib/client-hash";
import { cleanupReportData } from "@/lib/reports";

// 관리자 신고함의 동작. 모든 동작은 맨 앞에서 관리자 출입증을 다시 확인한다(requireAdmin).
// 할 수 있는 일은 일부러 좁게 둔다: 마감 표시, 숨기기, 일정·장소·참가비 고치기, 확인일 갱신.
// 모임을 지우거나 회원 정보를 보는 기능은 없다. 바꾼 내용은 admin_actions 에 전·후 값으로 남긴다.

const REPORTS_PATH = "/admin/reports";

// ── 들어가기·나가기 ──

const LOGIN_LIMITS = { perIp10min: 5, all1h: 30 }; // 같은 곳 10분 5번, 전체 1시간 30번 틀리면 잠시 막기

export type LoginState = { error?: "wrong" | "locked" | "off" } | undefined;

export async function loginAdmin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAdminEnabled()) return { error: "off" };
  const password = formData.get("password");
  if (typeof password !== "string" || password.length > 200) return { error: "wrong" };

  const ipHash = await clientIpHash();
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const failures = () => db().from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ok", false);
  const [mine, all] = await Promise.all([
    failures().eq("ip_hash", ipHash).gte("created_at", ago(10 * 60_000)),
    failures().gte("created_at", ago(3600_000)),
  ]);
  // 횟수를 셀 수 없으면 열어 주지 않는다
  if (mine.error || all.error) return { error: "locked" };
  if ((mine.count ?? 0) >= LOGIN_LIMITS.perIp10min || (all.count ?? 0) >= LOGIN_LIMITS.all1h) return { error: "locked" };

  const ok = checkPassword(password);
  await db().from("admin_login_attempts").insert({ ip_hash: ipHash, ok });
  if (!ok) return { error: "wrong" };

  (await cookies()).set(ADMIN_COOKIE, makeAdminToken(), ADMIN_COOKIE_OPTIONS);
  await cleanupReportData();
  redirect(REPORTS_PATH);
}

export async function logoutAdmin() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: ADMIN_COOKIE_OPTIONS.path });
  redirect(REPORTS_PATH);
}

// ── 신고 처리 ──

type MeetingFields = { status: string; is_hidden?: boolean; starts_at: string; place: string | null; fee_text: string | null; last_checked_at: string };

function toId(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

async function readMeeting(id: number): Promise<MeetingFields> {
  const { data, error } = await db().from("meetings").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("모임을 찾을 수 없습니다.");
  const m = data as MeetingFields;
  return { status: m.status, is_hidden: m.is_hidden, starts_at: m.starts_at, place: m.place, fee_text: m.fee_text, last_checked_at: m.last_checked_at };
}

// 모임을 바꾸고, 그 모임의 처리 전 신고를 모두 '처리 완료'로 닫고, 기록을 남긴다
async function apply(meetingId: number, action: "close" | "hide" | "edit" | "ok", changes: Partial<MeetingFields>) {
  const before = await readMeeting(meetingId);
  const update = { ...changes, last_checked_at: todayKst() };
  const { error } = await db().from("meetings").update(update).eq("id", meetingId);
  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  const pick = (o: Partial<MeetingFields>) => Object.fromEntries(Object.keys(update).map((k) => [k, o[k as keyof MeetingFields] ?? null]));
  const [closed, logged] = await Promise.all([
    db().from("reports").update({ status: "done", resolved_action: action, resolved_at: now }).eq("meeting_id", meetingId).eq("status", "open"),
    db().from("admin_actions").insert({ meeting_id: meetingId, action, before: pick(before), after: pick(update) }),
  ]);
  if (closed.error) throw new Error(closed.error.message);
  if (logged.error) console.error("[owl] admin action log failed", logged.error.message);

  // 목록·상세·마이페이지에 바뀐 정보가 바로 보이도록
  revalidatePath("/", "layout");
}

export async function resolveReport(formData: FormData) {
  await requireAdmin();
  const meetingId = toId(formData.get("meetingId"));
  const action = formData.get("action");
  if (!meetingId) throw new Error("잘못된 요청입니다.");

  if (action === "close") await apply(meetingId, "close", { status: "closed" });
  else if (action === "hide") await apply(meetingId, "hide", { is_hidden: true });
  else if (action === "ok") await apply(meetingId, "ok", {});
  else throw new Error("잘못된 요청입니다.");

  redirect(`${REPORTS_PATH}?done=${action}`);
}

// 의견·요청 '처리 완료'. 실제 책방 정보 수정·게시 중단은 Supabase 에서 직접 하고, 여기서는 닫기만 한다
export async function resolveInquiry(formData: FormData) {
  await requireAdmin();
  const id = toId(formData.get("inquiryId"));
  if (!id) throw new Error("잘못된 요청입니다.");
  const { error } = await db().from("inquiries").update({ status: "done", resolved_at: new Date().toISOString() }).eq("id", id).eq("status", "open");
  if (error) throw new Error(error.message);
  redirect(`${REPORTS_PATH}?done=inquiry`);
}

// 일정·장소·참가비 고치기. 일시는 한국 시간 '2026-10-08T19:30' 형식으로 받는다
export async function editMeeting(formData: FormData) {
  await requireAdmin();
  const meetingId = toId(formData.get("meetingId"));
  if (!meetingId) throw new Error("잘못된 요청입니다.");

  const startsRaw = formData.get("startsAt");
  if (typeof startsRaw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsRaw)) throw new Error("일시 형식이 올바르지 않습니다.");
  const startsAt = new Date(`${startsRaw}:00+09:00`);
  if (Number.isNaN(startsAt.getTime())) throw new Error("일시 형식이 올바르지 않습니다.");

  const text = (v: FormDataEntryValue | null, max: number) => {
    if (typeof v !== "string") return null;
    const s = v.trim().slice(0, max);
    return s || null;
  };

  await apply(meetingId, "edit", { starts_at: startsAt.toISOString(), place: text(formData.get("place"), 200), fee_text: text(formData.get("feeText"), 100) });
  redirect(`${REPORTS_PATH}?done=edit`);
}
