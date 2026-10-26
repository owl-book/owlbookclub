// 앱 알림: 화면(브라우저)과 서버가 함께 쓰는 이름·모양 (server-only 아님)

export type PushPrefKey = "meeting" | "store_new" | "exhibition";
export type PushPrefs = Record<PushPrefKey, boolean>;

export const DEFAULT_PUSH_PREFS: PushPrefs = { meeting: true, store_new: true, exhibition: true };

// 환경설정의 스위치 순서·문구
export const PUSH_PREF_ITEMS: { key: PushPrefKey; label: string; hint: string }[] = [
  { key: "meeting", label: "찜한 모임", hint: "모임 3일 전, 그리고 당일 아침" },
  { key: "store_new", label: "찜한 책방의 새 모임", hint: "새 모임이 올라오면 그다음 아침" },
  { key: "exhibition", label: "찜한 전시", hint: "전시가 끝나기 3일 전" },
];

export function isPushPrefKey(v: unknown): v is PushPrefKey {
  return v === "meeting" || v === "store_new" || v === "exhibition";
}

export type PushPlatform = "ios" | "android" | "desktop" | "other";

export function isPushPlatform(v: unknown): v is PushPlatform {
  return v === "ios" || v === "android" || v === "desktop" || v === "other";
}

// 기기가 알림 켜기 화면에서 보내는 '이 기기로 보내는 주소'
export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

// 알림 안에 담기는 내용(서비스 워커가 그대로 띄운다)
export type PushPayload = { title: string; body: string; url: string; tag?: string; sendId?: string };
