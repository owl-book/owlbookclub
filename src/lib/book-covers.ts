import "server-only";
import { cache } from "react";
import { db, hasDb } from "@/lib/db";

// 운영자가 직접 올린 책 표지(0017). 책마다 한 번: 제목이 같으면(titleKey) 어느 모임이든 같은 사진을 쓴다.

export const COVER_BUCKET = "book-covers";

// 같은 책으로 볼 기준: 띄어쓰기·괄호·따옴표·대소문자 차이는 무시한다. 'DB 표 0017 의 title_key' 와 같은 규칙
export function titleKey(title: string): string {
  return title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s『』「」《》〈〉<>"'“”‘’]/g, "");
}

export function coverPublicUrl(path: string): string {
  return db().storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type ManualCover = { titleKey: string; title: string; imagePath: string; url: string; updatedAt: string };

// 표지 표는 작아서(책 수만큼) 요청마다 한 번 통째로 읽고, 목록의 카드들이 나눠 쓴다
export const getManualCovers = cache(async (): Promise<Map<string, ManualCover>> => {
  const map = new Map<string, ManualCover>();
  if (!hasDb()) return map;
  const { data, error } = await db().from("book_covers").select("title_key, title, image_path, updated_at");
  // 0017 실행 전에는 표가 없다: 오류를 내지 않고 직접 올린 사진이 없는 것으로 본다
  if (error || !data) return map;
  for (const r of data as { title_key: string; title: string; image_path: string; updated_at: string }[]) {
    map.set(r.title_key, { titleKey: r.title_key, title: r.title, imagePath: r.image_path, url: coverPublicUrl(r.image_path), updatedAt: r.updated_at });
  }
  return map;
});

export async function getManualCover(title: string | null): Promise<ManualCover | null> {
  const q = title?.trim();
  if (!q) return null;
  return (await getManualCovers()).get(titleKey(q)) ?? null;
}

// 관리자 표지 화면: 모임에 적힌 책 제목을 책마다 하나로 묶는다(다가오는 모임이 있는 책을 위로)
export type CoverBook = { key: string; title: string; author: string | null; meetingCount: number; nextAt: string | null; cover: ManualCover | null };

export async function getCoverBooks(): Promise<CoverBook[]> {
  const { data, error } = await db()
    .from("meetings")
    .select("*")
    .not("book_title_text", "is", null)
    .order("starts_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const covers = await getManualCovers();
  const now = Date.now();
  const books = new Map<string, CoverBook>();
  for (const m of data as { book_title_text: string; book_author_text?: string | null; starts_at: string }[]) {
    const title = m.book_title_text.trim();
    if (!title) continue;
    const key = titleKey(title);
    const b = books.get(key) ?? { key, title, author: m.book_author_text?.trim() || null, meetingCount: 0, nextAt: null, cover: covers.get(key) ?? null };
    b.meetingCount += 1;
    if (!b.author && m.book_author_text?.trim()) b.author = m.book_author_text.trim();
    // 내림차순으로 읽으니 마지막에 남는 값이 가장 가까운 다가오는 모임이다
    if (new Date(m.starts_at).getTime() >= now) b.nextAt = m.starts_at;
    books.set(key, b);
  }

  // 사진이 없는 책 → 다가오는 모임이 있는 책 → 가까운 날짜 순
  return [...books.values()].sort((a, b) => {
    if (!a.cover !== !b.cover) return a.cover ? 1 : -1;
    if (!a.nextAt !== !b.nextAt) return a.nextAt ? -1 : 1;
    return (a.nextAt ?? "").localeCompare(b.nextAt ?? "");
  });
}
