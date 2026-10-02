import "server-only";

export type BookCover = { url: string; link: string | null };

export function hasAladinKey(): boolean {
  return Boolean(process.env.ALADIN_TTB_KEY?.trim());
}

type AladinItem = { cover?: string; link?: string };

// 알라딘 상품 검색 API로 책 제목 → 표지 이미지. 키가 없거나 실패하면 null(카드는 표지 자리 대체 디자인으로 보임).
// 같은 제목은 하루 동안 캐시해 API 호출 한도(일 5천 회)를 아낀다.
export async function getBookCover(title: string | null): Promise<BookCover | null> {
  const key = process.env.ALADIN_TTB_KEY?.trim();
  const q = title?.trim();
  if (!key || !q) return null;

  const url = new URL("https://www.aladin.co.kr/ttb/api/ItemSearch.aspx");
  url.search = new URLSearchParams({
    ttbkey: key,
    Query: q,
    QueryType: "Title",
    SearchTarget: "Book",
    MaxResults: "1",
    start: "1",
    Cover: "MidBig", // 가로 200px
    output: "js",
    Version: "20131101",
  }).toString();

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { item?: AladinItem[] };
    const item = data.item?.[0];
    if (!item?.cover) return null;
    return { url: item.cover.replace(/^http:/, "https:"), link: item.link ?? null };
  } catch {
    return null;
  }
}
