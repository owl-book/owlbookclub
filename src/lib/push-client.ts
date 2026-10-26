// 브라우저 쪽 알림 도우미: 이 기기에서 알림을 켤 수 있는지 살피고, 켜고 끈다.
import { isInstalled } from "@/lib/app-mode";
import { removePushSubscription, savePushSubscription } from "@/lib/push-actions";
import type { PushPlatform } from "@/lib/push-shared";

// unsupported: 이 브라우저는 알림 불가 / inapp: 카카오톡·인스타 같은 앱 안 화면 / ios-install: 아이폰인데 홈 화면 앱이 아님
// denied: 예전에 '차단'을 누름 / off: 켤 수 있음 / on: 켜져 있음
export type PushState = "unsupported" | "inapp" | "ios-install" | "denied" | "off" | "on";

const SW_URL = "/sw.js";

export function platform(): PushPlatform {
  const ua = navigator.userAgent;
  // 아이패드는 컴퓨터용 사파리처럼 보이므로 터치 지원으로 구별한다
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}


export function isInApp(): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(navigator.userAgent);
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  if (isInApp()) return "inapp";
  if (platform() === "ios" && !isInstalled()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted" && (await currentSubscription())) return "on";
  return "off";
}

// 이미 켜진 기기면 서버에 다시 알려 둔다(서버에서 지워졌거나 기기 주소가 바뀌었을 때 맞추기)
export async function syncPushSubscription(): Promise<void> {
  const sub = await currentSubscription();
  if (sub) await savePushSubscription(sub.toJSON(), platform(), isInstalled());
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// 알림 켜기: 반드시 버튼을 누른 순간에 불러야 한다(브라우저가 허락 창을 그때만 띄워 줌)
export async function turnOnPush(vapidKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
  await savePushSubscription(sub.toJSON(), platform(), isInstalled());
  return "on";
}

// 이 기기에서만 끄기
export async function turnOffPush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

// ── 찜한 순간 한 번 묻기: 이 기기에 '언제 물었는지'만 기억한다 ──

const ASK_KEY = "owl_push_ask";
const ASK_AGAIN_DAYS = 30;

type AskMemo = { at: number; answer: "yes" | "no" };

export function shouldAsk(): boolean {
  try {
    const raw = localStorage.getItem(ASK_KEY);
    if (!raw) return true;
    const memo = JSON.parse(raw) as AskMemo;
    // '괜찮아요'를 눌렀으면 30일 뒤에 한 번 더 묻는다. 켠 적이 있으면 다시 묻지 않는다
    return memo.answer === "no" && Date.now() - memo.at > ASK_AGAIN_DAYS * 86400000;
  } catch {
    return false;
  }
}

export function rememberAsk(answer: AskMemo["answer"]) {
  try {
    localStorage.setItem(ASK_KEY, JSON.stringify({ at: Date.now(), answer } satisfies AskMemo));
  } catch {
    // 저장 공간을 못 쓰는 브라우저: 다음에 다시 물을 수 있지만 큰 문제는 아니다
  }
}

// 찜 버튼이 찜을 저장한 직후 알리는 신호(PushAsk 가 듣는다)
export const WISHED_EVENT = "owl:wished";
export type WishedDetail = { kind: "meeting" | "store" | "exhibition" };
