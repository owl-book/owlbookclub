import "server-only";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// 카카오 연결 끊기. 카카오 개발자 사이트의 대표 어드민 키(KAKAO_ADMIN_KEY)가 있어야 동작한다.
// 이 키는 앱 전체를 관리할 수 있는 열쇠라 서버에만 두고 브라우저로 보내지 않는다.
// - 회원 탈퇴 때 우리 쪽에서 카카오에 "이 회원과의 연결을 끊어 주세요"라고 요청한다
// - 회원이 카카오 설정에서 직접 끊으면 카카오가 알림 주소(/api/auth/kakao-unlink)로 알려 온다. 이때 이 키로 진짜 카카오인지 확인한다

const UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";
const TIMEOUT_MS = 5000;
export const UNLINK_MAX_ATTEMPTS = 30;

export function kakaoAdminKey(): string | undefined {
  return process.env.KAKAO_ADMIN_KEY?.trim() || undefined;
}

// 카카오 알림이 진짜 카카오에서 왔는지: Authorization 머리글이 'KakaoAK {Admin 키}'와 같아야 한다
export function isKakaoAdminAuth(header: string | null): boolean {
  const key = kakaoAdminKey();
  if (!key || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`KakaoAK ${key}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// 카카오에 연결 끊기 요청. 실패하면 오류를 던진다(이미 끊긴 회원이면 성공으로 본다)
export async function unlinkKakao(providerUserId: string): Promise<void> {
  const key = kakaoAdminKey();
  if (!key) throw new Error("KAKAO_ADMIN_KEY 가 없습니다.");
  const res = await fetch(UNLINK_URL, {
    method: "POST",
    headers: { Authorization: `KakaoAK ${key}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ target_id_type: "user_id", target_id: providerUserId }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  // -101: 이 앱에 연결되지 않은 회원(이미 끊김) → 할 일이 없으니 성공으로 본다
  if (data?.code === -101) return;
  throw new Error(`kakao unlink ${res.status} ${data?.code ?? ""} ${data?.msg ?? ""}`.trim());
}

// 탈퇴 직후: 연결 끊기를 시도하고, 실패하면 매일 정리에서 다시 시도하도록 남겨 둔다.
// 어떤 경우에도 오류를 던지지 않는다(연결 끊기 때문에 탈퇴가 막히면 안 되므로)
export async function unlinkKakaoOrQueue(providerUserId: string): Promise<void> {
  if (!kakaoAdminKey()) return;
  try {
    await unlinkKakao(providerUserId);
  } catch (e) {
    console.error("[owl] kakao unlink failed, queued", (e as Error).message);
    const { error } = await db()
      .from("provider_unlinks")
      .upsert({ provider: "kakao", provider_user_id: providerUserId, last_error: (e as Error).message.slice(0, 300) }, { onConflict: "provider,provider_user_id" });
    if (error) console.error("[owl] kakao unlink queue failed", error.message);
  }
}
