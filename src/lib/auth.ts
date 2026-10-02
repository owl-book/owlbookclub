import "server-only";
import { cookies } from "next/headers";
import { db, hasDb } from "@/lib/db";
import { AUTH_COOKIE, LOGIN_MAX_AGE, hasAuthSecret, readSessionUser, type SessionUser } from "@/lib/auth-shared";
import { PROVIDER_ORDER, isProviderReady, type OAuthProfile, type ProviderId } from "@/lib/oauth";

// 로그인 기능을 켤 수 있는 상태인지(비밀키·DB·로그인 키 1개 이상)
export function isAuthEnabled(): boolean {
  return hasAuthSecret() && hasDb() && PROVIDER_ORDER.some(isProviderReady);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionUser(store.get(AUTH_COOKIE.user)?.value);
}

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

// 로그인 쿠키 설정값(로그인할 때와 별명을 바꿀 때 같은 값으로 다시 서명한다)
export const LOGIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LOGIN_MAX_AGE,
};
