import "server-only";
import { cache } from "react";
import { db, hasDb } from "@/lib/db";
import { attachSeries, collapseSeries, demoMeetings, getMeetingsSince, isPast, type Meeting } from "@/lib/meetings";

export type Store = {
  id: number;
  name: string;
  region: string;
  address: string | null;
  intro: string | null;
  hours: string | null; // 네이버 플레이스 기준 운영시간(여러 줄)
  phone: string | null; // 네이버 플레이스 기준 대표번호
  instagramUrl: string | null;
};

type StoreRow = {
  id: number;
  name: string;
  region: string;
  address?: string | null; // 0007 실행 전에는 없음
  intro?: string | null; // 0012 실행 전에는 없음
  hours?: string | null; // 0015 실행 전에는 없음
  phone?: string | null; // 0015 실행 전에는 없음
  instagram_url: string | null;
};

// 링크로 쓸 수 있는 주소만 남긴다(운영자가 '@아이디'만 적어 둔 경우 등은 버튼을 숨긴다)
function webUrl(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s && /^https?:\/\//i.test(s) ? s : null;
}

// 게재 차단 책방은 없는 책방으로 본다. 칸은 '*'로 읽는다: 소개(intro, 0012)·운영시간·대표번호(0015) 칸을 추가하기 전에도 화면이 깨지지 않게
// cache: 한 번 화면을 그리는 동안(탭 제목 만들기 + 본문) 같은 책방을 DB에서 두 번 읽지 않는다
export const getStore = cache(async function getStore(id: number): Promise<Store | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!hasDb()) return demoStore(id);
  const { data, error } = await db().from("stores").select("*").eq("id", id).eq("is_blocked", false).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as StoreRow;
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    address: r.address?.trim() || null,
    intro: r.intro?.trim() || null,
    hours: sortHoursByWeekday(r.hours),
    phone: r.phone?.trim() || null,
    instagramUrl: webUrl(r.instagram_url),
  };
});

// 운영시간 줄을 월→일 순으로 맞춘다. 줄 맨 앞 요일(또는 평일·주말)로 정렬하고,
// 요일로 시작하지 않는 줄(공휴일 휴무, 브레이크타임 등)은 적힌 순서대로 맨 뒤에 둔다.
const WEEKDAY_ORDER: Record<string, number> = { 월: 0, 평: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 주: 5, 일: 6 };

function sortHoursByWeekday(v: string | null | undefined): string | null {
  const lines = v?.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines?.length) return null;
  const rank = (l: string) => {
    if (/^(평일|주말)/.test(l)) return WEEKDAY_ORDER[l[0]];
    return /^[월화수목금토일](?![가-힣])|^[월화수목금토일]요일/.test(l) ? WEEKDAY_ORDER[l[0]] : 7;
  };
  return lines
    .map((l, i) => ({ l, i, r: rank(l) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.l)
    .join("\n");
}

export type StoreOption = { id: number; name: string; region: string };

// '의견·요청 보내기'의 책방 고르기 칸: 보이는 책방 전부를 지역·이름 순으로
export async function listStoreOptions(): Promise<StoreOption[]> {
  if (!hasDb()) {
    const seen = new Map<number, StoreOption>();
    for (const m of demoMeetings(new Date())) seen.set(m.store.id, { id: m.store.id, name: m.store.name, region: m.store.region });
    return [...seen.values()];
  }
  const { data, error } = await db().from("stores").select("id, name, region").eq("is_blocked", false).order("region").order("name").limit(1000);
  if (error) throw new Error(error.message);
  return data as StoreOption[];
}

// 책방 모아보기 한 칸: 목록 카드에 필요한 것만
export type StoreSummary = {
  id: number;
  name: string;
  region: string;
  intro: string | null;
  createdAt: string; // 최신·오래된 등록순 정렬용
  openCount: number; // 지금 신청할 수 있는 모임 수(묶음 모임은 1개로)
};

// 책방 모아보기: 공개된 모임이 한 번이라도 올라온 책방 전부(지금 모집 중인 모임이 0개여도 넣는다).
// 승인 대기 책방은 is_blocked 라서 빠진다. 정렬은 화면에서 한다
export async function listStoreSummaries(now = new Date()): Promise<StoreSummary[]> {
  if (!hasDb()) {
    const map = new Map<number, StoreSummary>();
    for (const m of demoMeetings(now)) {
      const s = map.get(m.store.id) ?? { id: m.store.id, name: m.store.name, region: m.store.region, intro: demoStore(m.store.id)?.intro ?? null, createdAt: `2026-10-0${m.store.id}`, openCount: 0 };
      if (!isPast(m, now) && m.status === "open") s.openCount++;
      map.set(m.store.id, s);
    }
    return [...map.values()];
  }
  const [stores, meetings] = await Promise.all([
    db().from("stores").select("*").eq("is_blocked", false).limit(1000),
    db().from("meetings").select("id, store_id, starts_at, status, series_key, is_hidden").eq("is_hidden", false).limit(5000),
  ]);
  if (stores.error) throw new Error(stores.error.message);
  if (meetings.error) throw new Error(meetings.error.message);

  type Row = { id: number; store_id: number; starts_at: string; status: string; series_key: string | null };
  const listed = new Set<number>();
  // 책방별로 지금 신청할 수 있는 모임을 센다. 같은 묶음(series_key)의 회차들은 한 번에 신청하니 하나로 센다
  const open = new Map<number, Set<string>>();
  for (const m of meetings.data as Row[]) {
    listed.add(m.store_id);
    if (m.status !== "open" || new Date(m.starts_at).getTime() < now.getTime()) continue;
    const keys = open.get(m.store_id) ?? new Set<string>();
    keys.add(m.series_key?.trim() || `id:${m.id}`);
    open.set(m.store_id, keys);
  }
  return (stores.data as (StoreRow & { created_at: string })[])
    .filter((r) => listed.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      region: r.region,
      intro: r.intro?.trim() || null,
      createdAt: r.created_at,
      openCount: open.get(r.id)?.size ?? 0,
    }));
}

// 이 책방의 다가오는 모임(가까운 날짜순)과 최근 지난 모임(최근순)
export async function getStoreMeetings(storeId: number, now = new Date(), pastDays = 90): Promise<{ upcoming: Meeting[]; past: Meeting[] }> {
  const all = hasDb()
    ? await getMeetingsSince(new Date(now.getTime() - pastDays * 86400000), { storeId })
    : demoMeetings(now).filter((m) => m.store.id === storeId);
  const sorted = (await attachSeries(all)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return {
    // 여러 회차를 한 번에 신청하는 모임은 가장 가까운 회차 한 장으로 접는다. 지난 모임은 회차별 기록을 위해 그대로 둔다
    upcoming: collapseSeries(sorted.filter((m) => !isPast(m, now))),
    past: sorted.filter((m) => isPast(m, now)).reverse(),
  };
}

// ── DB 연결 전 로컬 미리보기용 ──
function demoStore(id: number): Store | null {
  const m = demoMeetings(new Date()).find((x) => x.store.id === id);
  if (!m) return null;
  return {
    ...m.store,
    intro: id === 1 ? "골목 2층, 소설이 많은 작은 책방" : null,
    hours: id === 1 ? "월 휴무\n화~토 12:00–20:00\n일 13:00–18:00" : null,
    phone: id === 1 ? "02-123-4567" : null,
    instagramUrl: id === 3 ? null : "https://www.instagram.com/",
  };
}
