import "server-only";
import { getManualCovers, titleKey } from "@/lib/book-covers";
import { db } from "@/lib/db";
import { getReviewCount } from "@/lib/review";

// 관리자 위쪽 탭에 붙는 숫자만 가볍게 센다. 신고·의견은 개수만(count 쿼리), 목록 전체를 읽어 오지 않는다.
export type AdminTabCounts = { review: number; reports: number; covers: number };

async function countOpen(table: "reports" | "inquiries"): Promise<number> {
  const { count, error } = await db().from(table).select("id", { count: "exact", head: true }).eq("status", "open");
  if (error) {
    // 의견 표(0016)가 아직 없을 때처럼 못 읽으면 0으로 보고 화면은 그대로 연다
    console.error(`[owl] ${table} count failed`, error.message);
    return 0;
  }
  return count ?? 0;
}

// 사진이 없는 책 수. 같은 책(제목 기준)을 한 번만 세야 해서 단순 count 로는 안 되고, 제목 한 칸만 읽어 센다
async function countCoverMissing(): Promise<number> {
  const [{ data, error }, covers] = await Promise.all([
    db().from("meetings").select("book_title_text").not("book_title_text", "is", null).limit(1000),
    getManualCovers(),
  ]);
  if (error) throw new Error(error.message);
  const keys = new Set<string>();
  for (const m of data as { book_title_text: string }[]) {
    const t = m.book_title_text.trim();
    if (t) keys.add(titleKey(t));
  }
  let missing = 0;
  for (const k of keys) if (!covers.has(k)) missing += 1;
  return missing;
}

export async function getAdminTabCounts(opts: { review?: number } = {}): Promise<AdminTabCounts> {
  const [review, reports, inquiries, covers] = await Promise.all([
    opts.review ?? getReviewCount(),
    countOpen("reports"),
    countOpen("inquiries"),
    countCoverMissing(),
  ]);
  return { review, reports: reports + inquiries, covers };
}
