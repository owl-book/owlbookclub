import "server-only";
import { db } from "@/lib/db";
import { getPushPrefsFor, getPushUserIds, getSubscriptionsFor, sendToUser } from "@/lib/push";
import type { PushPayload } from "@/lib/push-shared";
import { dayKey, formatDateString, formatKstDateOnly, kstDayNumber, meetingTime } from "@/lib/time";

// 매일 아침 한 번, 알림 받는 사람마다 오늘 알려 줄 것을 모아 한 통으로 보낸다.
// 1) 찜한 모임: 모임 3일 전(신청 마감 전이라 모집 중일 때만), 모임 당일 아침
// 2) 찜한 책방의 새 모임: 찜한 뒤에 공개된 모임(최근 3일 안). 이미 찜한 모임은 1)로 가니 뺀다
// 3) 찜한 전시: 마지막 날 3일 전
// 같은 항목은 두 번 보내지 않는다(push_sent_items). 숨긴 모임·전시, 게재를 내린 책방은 보내지 않는다.

type ItemKind = "meeting_today" | "meeting_3d" | "exhibition_end" | "store_new";

type Item = {
  key: string; // push_sent_items 의 이름표
  kind: ItemKind;
  title: string;
  storeId: number;
  storeName: string;
  url: string;
  detail: string; // 한 건만 보낼 때 둘째 줄
  seriesKey?: string | null;
};

// 여러 건을 묶을 때 맨 앞에 오는 순서(급한 것부터)
const ORDER: ItemKind[] = ["meeting_today", "meeting_3d", "exhibition_end", "store_new"];

const NEW_MEETING_DAYS = 3;

type MeetingLite = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  time_note: string | null;
  status: "open" | "closed";
  is_hidden: boolean;
  series_key: string | null;
  published_at: string | null;
  store: { id: number; name: string; is_blocked: boolean };
};

const MEETING_COLS = "id, title, starts_at, ends_at, time_note, status, is_hidden, series_key, published_at, store:stores!inner(id, name, is_blocked)";

function when(m: MeetingLite): string {
  return meetingTime({ startsAt: new Date(m.starts_at), endsAt: m.ends_at ? new Date(m.ends_at) : null, timeNote: m.time_note });
}

function visible(m: MeetingLite): boolean {
  return !m.is_hidden && !m.store.is_blocked;
}

function push(map: Map<string, Item[]>, userId: string, item: Item) {
  map.set(userId, [...(map.get(userId) ?? []), item]);
}

export type DigestResult = { users: number; sent: number; items: number; skipped: number };

export async function runDailyDigest(now = new Date()): Promise<DigestResult> {
  const userIds = await getPushUserIds();
  if (userIds.length === 0) return { users: 0, sent: 0, items: 0, skipped: 0 };
  const prefs = await getPushPrefsFor(userIds);
  const today = kstDayNumber(now);
  const items = new Map<string, Item[]>();

  // ── 1) 찜한 모임 ──
  const meetingUsers = userIds.filter((u) => prefs.get(u)?.meeting);
  const wishedMeetingIds = new Map<string, Set<number>>();
  if (meetingUsers.length > 0) {
    // 오늘 0시(KST)부터 4일 뒤 0시 전까지 열리는 모임만 읽는다
    const from = new Date(today * 86400000 - 9 * 3600000);
    const to = new Date((today + 4) * 86400000 - 9 * 3600000);
    const { data, error } = await db()
      .from("meeting_wishes")
      .select(`user_id, meeting:meetings!inner(${MEETING_COLS})`)
      .in("user_id", meetingUsers);
    if (error) throw new Error(`찜한 모임 읽기 실패: ${error.message}`);
    for (const r of (data ?? []) as unknown as { user_id: string; meeting: MeetingLite }[]) {
      const set = wishedMeetingIds.get(r.user_id) ?? new Set<number>();
      set.add(r.meeting.id);
      wishedMeetingIds.set(r.user_id, set);
      const m = r.meeting;
      const start = new Date(m.starts_at);
      if (!visible(m) || start < from || start >= to) continue;
      const diff = kstDayNumber(start) - today;
      // 당일 알림은 이미 시작한 모임이면 보내지 않는다(아침 9시 전에 시작하는 모임 등)
      if (diff === 0 && start > now) {
        push(items, r.user_id, { key: `m0:${m.id}`, kind: "meeting_today", title: m.title, storeId: m.store.id, storeName: m.store.name, url: `/m/${m.id}`, detail: `${m.store.name} · 오늘 ${when(m)}` });
      } else if (diff === 3 && m.status === "open") {
        push(items, r.user_id, { key: `m3:${m.id}`, kind: "meeting_3d", title: m.title, storeId: m.store.id, storeName: m.store.name, url: `/m/${m.id}`, detail: `${m.store.name} · ${formatKstDateOnly(start)} ${when(m)}` });
      }
    }
  }
  // 책방 새 모임에서 '이미 찜한 모임'을 빼려면 새 모임 알림만 켠 사람의 찜도 알아야 한다
  const storeUsers = userIds.filter((u) => prefs.get(u)?.store_new);
  const missing = storeUsers.filter((u) => !meetingUsers.includes(u));
  if (missing.length > 0) {
    const { data, error } = await db().from("meeting_wishes").select("user_id, meeting_id").in("user_id", missing);
    if (error) throw new Error(`찜한 모임 읽기 실패: ${error.message}`);
    for (const r of (data ?? []) as { user_id: string; meeting_id: number }[]) {
      const set = wishedMeetingIds.get(r.user_id) ?? new Set<number>();
      set.add(r.meeting_id);
      wishedMeetingIds.set(r.user_id, set);
    }
  }

  // ── 2) 찜한 책방의 새 모임 ──
  if (storeUsers.length > 0) {
    const { data: wishes, error } = await db().from("store_wishes").select("user_id, store_id, created_at").in("user_id", storeUsers);
    if (error) throw new Error(`찜한 책방 읽기 실패: ${error.message}`);
    const storeWishes = (wishes ?? []) as { user_id: string; store_id: number; created_at: string }[];
    const storeIds = [...new Set(storeWishes.map((w) => w.store_id))];
    if (storeIds.length > 0) {
      const since = new Date(now.getTime() - NEW_MEETING_DAYS * 86400000).toISOString();
      const { data, error: mErr } = await db()
        .from("meetings")
        .select(MEETING_COLS)
        .in("store_id", storeIds)
        .gte("published_at", since)
        .gt("starts_at", now.toISOString())
        .order("starts_at");
      if (mErr) throw new Error(`새 모임 읽기 실패: ${mErr.message}`);
      const fresh = ((data ?? []) as unknown as MeetingLite[]).filter(visible);
      for (const w of storeWishes) {
        const seen = new Set<string>();
        for (const m of fresh) {
          if (m.store.id !== w.store_id || !m.published_at || m.published_at < w.created_at) continue;
          if (wishedMeetingIds.get(w.user_id)?.has(m.id)) continue;
          // 여러 회차를 한 번에 신청하는 모임은 첫 회차 하나로만 알린다
          if (m.series_key) {
            if (seen.has(m.series_key)) continue;
            seen.add(m.series_key);
          }
          push(items, w.user_id, { key: `s:${m.id}`, kind: "store_new", title: m.title, storeId: m.store.id, storeName: m.store.name, url: `/m/${m.id}`, detail: `${formatKstDateOnly(new Date(m.starts_at))} ${when(m)}`, seriesKey: m.series_key });
        }
      }
    }
  }

  // ── 3) 찜한 전시 ──
  const exhibitionUsers = userIds.filter((u) => prefs.get(u)?.exhibition);
  if (exhibitionUsers.length > 0) {
    const endsOn = dayKey(today + 3);
    const { data, error } = await db()
      .from("exhibition_wishes")
      .select("user_id, exhibition:exhibitions!inner(id, title, ends_on, is_hidden, store:stores!inner(id, name, is_blocked))")
      .in("user_id", exhibitionUsers)
      .eq("exhibition.ends_on", endsOn);
    if (error) throw new Error(`찜한 전시 읽기 실패: ${error.message}`);
    type Row = { user_id: string; exhibition: { id: number; title: string; ends_on: string; is_hidden: boolean; store: { id: number; name: string; is_blocked: boolean } } };
    for (const r of (data ?? []) as unknown as Row[]) {
      const e = r.exhibition;
      if (e.is_hidden || e.store.is_blocked) continue;
      push(items, r.user_id, { key: `e3:${e.id}`, kind: "exhibition_end", title: e.title, storeId: e.store.id, storeName: e.store.name, url: `/e/${e.id}`, detail: `${e.store.name} · ${formatDateString(e.ends_on)}까지` });
    }
  }

  // ── 이미 보낸 것 빼기 ──
  const targets = [...items.keys()];
  if (targets.length === 0) return { users: userIds.length, sent: 0, items: 0, skipped: 0 };
  const { data: sentRows, error: sentErr } = await db()
    .from("push_sent_items")
    .select("user_id, item_key")
    .in("user_id", targets)
    .in("item_key", [...new Set([...items.values()].flat().map((i) => i.key))]);
  if (sentErr) throw new Error(`보낸 알림 읽기 실패: ${sentErr.message}`);
  const sent = new Set(((sentRows ?? []) as { user_id: string; item_key: string }[]).map((r) => `${r.user_id}|${r.item_key}`));

  const subs = await getSubscriptionsFor(targets);
  let sentCount = 0;
  let itemCount = 0;
  let skipped = 0;
  for (const userId of targets) {
    const list = (items.get(userId) ?? [])
      .filter((i) => !sent.has(`${userId}|${i.key}`))
      .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    if (list.length === 0) continue;
    try {
      const delivered = await sendToUser(userId, subs.get(userId) ?? [], compose(list), { kinds: [...new Set(list.map((i) => i.kind))], itemCount: list.length });
      if (delivered === 0) {
        skipped++;
        continue;
      }
      const { error } = await db()
        .from("push_sent_items")
        .upsert(list.map((i) => ({ user_id: userId, item_key: i.key })), { onConflict: "user_id,item_key", ignoreDuplicates: true });
      if (error) console.error("[owl] push sent items save failed", error.message);
      sentCount++;
      itemCount += list.length;
    } catch (e) {
      // 한 사람 실패가 다른 사람 알림을 막지 않게
      skipped++;
      console.error("[owl] push digest user failed", (e as Error).message);
    }
  }
  return { users: userIds.length, sent: sentCount, items: itemCount, skipped };
}

// 알림 한 통의 제목·내용. 한 건이면 그 내용을 그대로, 여러 건이면 짧은 줄로 묶는다
export function compose(list: Item[]): PushPayload {
  if (list.length === 1) {
    const i = list[0];
    const title =
      i.kind === "meeting_today" ? "오늘 찜한 모임이 있어요"
      : i.kind === "meeting_3d" ? "찜한 모임이 3일 남았어요"
      : i.kind === "exhibition_end" ? "찜한 전시가 3일 뒤 끝나요"
      : `${i.storeName}에 새 모임이 올라왔어요`;
    return { title, body: `${i.title}\n${i.detail}`, url: withFrom(i.url) };
  }

  // 모두 한 책방의 새 모임이면 그 책방 화면으로
  if (list.every((i) => i.kind === "store_new" && i.storeId === list[0].storeId)) {
    return {
      title: `${list[0].storeName}에 새 모임 ${list.length}개가 올라왔어요`,
      body: list.slice(0, 3).map((i) => i.title).join("\n") + (list.length > 3 ? `\n외 ${list.length - 3}개` : ""),
      url: withFrom(`/s/${list[0].storeId}`),
    };
  }

  const label: Record<ItemKind, string> = { meeting_today: "오늘", meeting_3d: "3일 뒤", exhibition_end: "전시 마감", store_new: "새 모임" };
  const lines = list.slice(0, 3).map((i) => `${label[i.kind]} · ${i.kind === "store_new" ? `${i.storeName} ${i.title}` : i.title}`);
  if (list.length > 3) lines.push(`외 ${list.length - 3}개`);
  const first = list[0].kind;
  const tab = first === "exhibition_end" ? "exhibitions" : first === "store_new" ? "stores" : "meetings";
  return {
    title: first === "meeting_today" ? "오늘 찜한 모임이 있어요" : `찜한 소식 ${list.length}개가 있어요`,
    body: lines.join("\n"),
    url: withFrom(`/me?tab=${tab}`),
  };
}

// 알림으로 들어온 방문인지 구글 애널리틱스·주소에서 알 수 있게
function withFrom(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}from=push`;
}
