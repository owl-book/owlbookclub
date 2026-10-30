import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, hasDb } from "@/lib/db";
import { AUTH_COOKIE, LOGIN_MAX_AGE, hasAuthSecret, readSessionUser, safeNext, type SessionUser } from "@/lib/auth-shared";
import { PROVIDER_ORDER, isProviderReady, type OAuthProfile, type ProviderId } from "@/lib/oauth";

// 로그인 기능을 켤 수 있는 상태인지(비밀키·DB·로그인 키 1개 이상)
export function isAuthEnabled(): boolean {
  return hasAuthSecret() && hasDb() && PROVIDER_ORDER.some(isProviderReady);
}

// cache: 머리글·본문·찜 확인이 한 화면 안에서 여러 번 불러도 로그인 확인은 한 번만 한다
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionUser(store.get(AUTH_COOKIE.user)?.value);
});

// 같은 회사·같은 회원번호면 기존 회원, 없으면 새로 만든다. 별명은 매번 최신으로 갱신.
// 사용자가 마이페이지에서 정한 별명(display_name)은 덮어쓰지 않고 함께 돌려준다.
export async function upsertUser(
  provider: ProviderId,
  profile: OAuthProfile,
): Promise<{ id: string; isNew: boolean; displayName: string | null }> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("users")
    .upsert(
      {
        provider,
        provider_user_id: profile.providerUserId,
        nickname: profile.nickname?.slice(0, 40) ?? null,
        last_login_at: now,
      },
      { onConflict: "provider,provider_user_id" },
    )
    .select("id, created_at")
    .single();
  if (error || !data) throw new Error(`users upsert failed: ${error?.message}`);
  // 방금 만들어졌으면 created_at 이 지금과 거의 같다
  const isNew = Date.now() - new Date(data.created_at).getTime() < 10_000;
  // display_name 칸이 아직 없어도(설정문 실행 전) 로그인은 되도록 따로 읽고 오류는 무시
  const extra = await db().from("users").select("display_name").eq("id", data.id).maybeSingle();
  return { id: data.id, isNew, displayName: extra.data?.display_name ?? null };
}

// 로그인 쿠키는 살아 있는데 회원 명단(users)에 없는 경우: 다른 기기에서 탈퇴했거나, 내 컴퓨터를 시험용 DB로 바꾼 뒤 남은 쿠키.
// 그대로 두면 찜·내 모임이 '저장하지 못했어요'만 반복된다. 화면을 볼 때는 확인하지 않고(매번 DB를 읽지 않게) 저장하기 직전에만 확인한다.
export async function isKnownUser(id: string): Promise<boolean> {
  const { data, error } = await db().from("users").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`회원 확인 실패: ${error.message}`);
  return Boolean(data);
}

// 명단에 없는 회원을 로그인 화면으로 보낼 주소. 로그인 쿠키를 먼저 지워야 한다(로그인 화면은 쿠키가 있으면 바로 돌려보낸다)
export function goneLoginPath(next: string): string {
  return `/login?error=gone&next=${encodeURIComponent(next)}`;
}

// 서버 동작(찜·내 모임·기록·알림)에서: 명단에 없으면 로그인 쿠키를 지우고, 보던 화면으로 돌아오는 로그인 화면으로 보낸다
export async function signOutIfGone(id: string): Promise<void> {
  if (await isKnownUser(id)) return;
  const [store, head] = await Promise.all([cookies(), headers()]);
  store.set(AUTH_COOKIE.user, "", { path: "/", maxAge: 0 });
  let back = "/";
  try {
    const ref = new URL(head.get("referer") ?? "");
    back = safeNext(ref.pathname + ref.search);
  } catch {}
  redirect(goneLoginPath(back));
}

// 로그인 쿠키 설정값(로그인할 때와 별명을 바꿀 때 같은 값으로 다시 서명한다)
export const LOGIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LOGIN_MAX_AGE,
};
