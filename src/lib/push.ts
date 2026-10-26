import "server-only";
import webpush from "web-push";
import { db, hasDb } from "@/lib/db";
import { DEFAULT_PUSH_PREFS, type PushPayload, type PushPlatform, type PushPrefs, type PushSubscriptionInput } from "@/lib/push-shared";

// 앱 알림 보내기·기기 저장. 열쇠(VAPID)가 없으면 알림 기능 전체를 '준비 중'으로 둔다.
// 기기 주소(endpoint)는 휴대폰 회사(구글·애플 등)의 알림 서버 주소라서, 내용은 그 회사를 거쳐 기기로 간다.

export function vapidPublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || undefined;
}

function vapidPrivateKey(): string | undefined {
  return process.env.VAPID_PRIVATE_KEY?.trim() || undefined;
}

export function isPushEnabled(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey()) && hasDb();
}

let configured = false;
function configure() {
  if (configured) return;
  const pub = vapidPublicKey();
  const priv = vapidPrivateKey();
  if (!pub || !priv) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 환경변수가 없습니다.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "https://www.owlbookclub.com", pub, priv);
  configured = true;
}

// ── 알림 종류별 켜고 끄기 ──

type PrefsRow = { user_id: string; meeting: boolean; store_new: boolean; exhibition: boolean };

function prefsFromRow(r: PrefsRow | null | undefined): PushPrefs {
  return r ? { meeting: r.meeting, store_new: r.store_new, exhibition: r.exhibition } : { ...DEFAULT_PUSH_PREFS };
}

export async function getPushPrefs(userId: string): Promise<PushPrefs> {
  const { data, error } = await db().from("push_prefs").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`알림 설정 읽기 실패: ${error.message}`);
  return prefsFromRow(data as PrefsRow | null);
}

export async function getPushPrefsFor(userIds: string[]): Promise<Map<string, PushPrefs>> {
  const map = new Map<string, PushPrefs>();
  if (userIds.length === 0) return map;
  const { data, error } = await db().from("push_prefs").select("*").in("user_id", userIds);
  if (error) throw new Error(`알림 설정 읽기 실패: ${error.message}`);
  for (const r of (data ?? []) as PrefsRow[]) map.set(r.user_id, prefsFromRow(r));
  for (const id of userIds) if (!map.has(id)) map.set(id, { ...DEFAULT_PUSH_PREFS });
  return map;
}

export async function savePushPrefs(userId: string, prefs: PushPrefs) {
  const { error } = await db()
    .from("push_prefs")
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(`알림 설정 저장 실패: ${error.message}`);
}

// ── 기기 ──

// 같은 기기 주소가 다른 회원으로 저장돼 있으면(한 기기에서 계정을 바꿔 로그인) 지금 회원으로 옮긴다.
// 운영자 기기 표시는 켜기만 하고 끄지 않는다: 아이폰 홈 화면 앱은 사파리와 저장 공간이 따로라 ?owl_internal=1 표시가 없어서,
// 다시 저장할 때마다 '일반'으로 돌아가 버리기 때문(운영자 기기로 바꾼 줄은 DB에서 직접 is_internal = true 로 둔다)
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
  device: { platform: PushPlatform; installed: boolean; isInternal: boolean },
) {
  const { error } = await db()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        platform: device.platform,
        installed: device.installed,
        // 빼 두면 새 기기는 기본값(일반)으로, 이미 있는 기기는 원래 표시 그대로 남는다
        ...(device.isInternal ? { is_internal: true } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error(`알림 기기 저장 실패: ${error.message}`);
}

export async function removeSubscription(userId: string, endpoint: string) {
  const { error } = await db().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  if (error) throw new Error(`알림 기기 지우기 실패: ${error.message}`);
}

// ── 보내기 ──

type SubRow = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string; is_internal: boolean };

export async function getSubscriptionsFor(userIds: string[]): Promise<Map<string, SubRow[]>> {
  const map = new Map<string, SubRow[]>();
  if (userIds.length === 0) return map;
  const { data, error } = await db().from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, is_internal").in("user_id", userIds);
  if (error) throw new Error(`알림 기기 읽기 실패: ${error.message}`);
  for (const r of (data ?? []) as SubRow[]) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r]);
  return map;
}

// 알림 받는 사람(기기가 하나라도 있는 회원) 전부
export async function getPushUserIds(): Promise<string[]> {
  const { data, error } = await db().from("push_subscriptions").select("user_id");
  if (error) throw new Error(`알림 기기 읽기 실패: ${error.message}`);
  return [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
}

// 한 사람의 모든 기기로 한 통을 보낸다. 보낸 기록(push_sends)을 먼저 남겨 그 번호를 알림에 실어 보낸다(열어 봤는지 세려고).
// 기기가 사라졌다고 답하면(404·410: 앱 삭제·알림 끔) 그 기기는 지운다. 전달된 기기 수를 돌려준다
export async function sendToUser(userId: string, subs: SubRow[], payload: PushPayload, meta: { kinds: string[]; itemCount: number }): Promise<number> {
  if (subs.length === 0) return 0;
  configure();
  const { data, error } = await db()
    .from("push_sends")
    .insert({ user_id: userId, kinds: meta.kinds, item_count: meta.itemCount, is_internal: subs.every((s) => s.is_internal) })
    .select("id")
    .single();
  if (error || !data) throw new Error(`알림 기록 실패: ${error?.message}`);
  const body = JSON.stringify({ ...payload, sendId: data.id });

  let delivered = 0;
  const gone: number[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        // TTL: 기기가 꺼져 있으면 하루까지 기다렸다 전달(그보다 늦은 아침 알림은 의미가 없어서)
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "normal" });
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("[owl] push send failed", status, (e as Error).message);
      }
    }),
  );
  if (gone.length > 0) await db().from("push_subscriptions").delete().in("id", gone);
  await db().from("push_sends").update({ devices: delivered }).eq("id", data.id);
  return delivered;
}

// 알림을 눌러 열었을 때(서비스 워커가 알려 줌). 처음 연 시각만 남긴다
export async function markOpened(sendId: string) {
  const { error } = await db().from("push_sends").update({ opened_at: new Date().toISOString() }).eq("id", sendId).is("opened_at", null);
  if (error) console.error("[owl] push open mark failed", error.message);
}
