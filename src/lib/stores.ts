import "server-only";
import { cache } from "react";
import { db, hasDb } from "@/lib/db";
import { demoMeetings, getMeetingsSince, isPast, type Meeting } from "@/lib/meetings";

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

// 이 책방의 다가오는 모임(가까운 날짜순)과 최근 지난 모임(최근순)
export async function getStoreMeetings(storeId: number, now = new Date(), pastDays = 90): Promise<{ upcoming: Meeting[]; past: Meeting[] }> {
  const all = hasDb()
    ? await getMeetingsSince(new Date(now.getTime() - pastDays * 86400000), { storeId })
    : demoMeetings(now).filter((m) => m.store.id === storeId);
  const sorted = [...all].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return {
    upcoming: sorted.filter((m) => !isPast(m, now)),
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
