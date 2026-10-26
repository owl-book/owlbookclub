"use server";

import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getPushPrefs, getSubscriptionsFor, isPushEnabled, removeSubscription, savePushPrefs, saveSubscription, sendToUser } from "@/lib/push";
import { isPushPlatform, isPushPrefKey, type PushPlatform, type PushPrefKey, type PushSubscriptionInput } from "@/lib/push-shared";
import { getTrackContext } from "@/lib/tracking";

// 알림 켜기·끄기·종류 고르기. 화면 밖에서 직접 호출될 수도 있으므로 매번 로그인 본인인지 확인한다.

async function requireUser() {
  if (!isAuthEnabled() || !isPushEnabled()) throw new Error("알림 기능이 꺼져 있습니다.");
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
}

// 서버가 이 주소로 직접 알림을 보내므로, 알려진 휴대폰·브라우저 회사의 알림 서버 주소만 받는다
// (아무 주소나 받으면 우리 서버가 엉뚱한 곳으로 요청을 보내는 데 쓰일 수 있어서)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

function validSubscription(v: unknown): v is PushSubscriptionInput {
  const s = v as PushSubscriptionInput;
  return (
    typeof s?.endpoint === "string" &&
    s.endpoint.length <= 1000 &&
    isPushEndpoint(s.endpoint) &&
    typeof s.keys?.p256dh === "string" &&
    s.keys.p256dh.length <= 200 &&
    typeof s.keys?.auth === "string" &&
    s.keys.auth.length <= 100
  );
}

// 이 기기에서 알림 켜기(이미 켜져 있으면 기기 정보만 새로 고친다)
export async function savePushSubscription(sub: unknown, platform: PushPlatform, installed: boolean): Promise<void> {
  const user = await requireUser();
  if (!validSubscription(sub)) throw new Error("잘못된 요청입니다.");
  const { isInternal } = await getTrackContext();
  await saveSubscription(
    user.id,
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    { platform: isPushPlatform(platform) ? platform : "other", installed: installed === true, isInternal },
  );
}

// 이 기기에서 알림 끄기(다른 기기는 그대로)
export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await requireUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) throw new Error("잘못된 요청입니다.");
  await removeSubscription(user.id, endpoint);
}

// 알림 종류 하나 켜고 끄기. 저장된 최종 상태를 돌려준다
export async function setPushPref(key: PushPrefKey, on: boolean): Promise<boolean> {
  const user = await requireUser();
  if (!isPushPrefKey(key) || typeof on !== "boolean") throw new Error("잘못된 요청입니다.");
  const prefs = await getPushPrefs(user.id);
  await savePushPrefs(user.id, { ...prefs, [key]: on });
  return on;
}

// 시험 알림: 내 모든 기기로 한 통. 운영자 화면의 통계에는 넣지 않는다(종류 test)
export async function sendTestPush(): Promise<number> {
  const user = await requireUser();
  const subs = (await getSubscriptionsFor([user.id])).get(user.id) ?? [];
  return sendToUser(
    user.id,
    subs,
    { title: "알림이 잘 와요", body: "찜한 모임·책방·전시 소식을 아침에 이렇게 알려드릴게요.", url: "/me/settings", tag: "owl-test" },
    { kinds: ["test"], itemCount: 1 },
  );
}
