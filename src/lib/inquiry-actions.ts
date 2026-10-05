"use server";

import { db, hasDb } from "@/lib/db";
import { clientIpHash } from "@/lib/client-hash";
import { INQUIRY_LIMITS, findInquiryTopic, type InquiryInput, type InquiryResult } from "@/lib/inquiry-kinds";
import { cleanupReportData } from "@/lib/reports";
import { getStore } from "@/lib/stores";
import { getTrackContext } from "@/lib/tracking";

// 풋바 '의견·요청 보내기' 받기. 로그인 없이 누구나 보낼 수 있으므로 정보 오류 신고(report-actions)와 같은 원칙을 따른다:
// - 글자로만 저장하고 길이를 자른다(신고함에서도 글자로만 보여 준다)
// - 같은 곳에서 짧은 시간에 여러 번 보내면 막는다
// - 보기에 없는 칸은 저장하지 않는다(예: 연락처가 필요 없는 보기에 연락처가 와도 버린다)
const LIMITS = {
  per10min: 3, // 같은 곳에서 10분에 3건
  perDay: 10, // 같은 곳에서 하루 10건
  allPerHour: 100, // 사이트 전체 1시간 100건
};

export async function submitInquiry(input: InquiryInput): Promise<InquiryResult> {
  if (!hasDb()) return { ok: false, reason: "failed" };
  if (input.website) return { ok: true };

  const found = findInquiryTopic(input.category, input.topic);
  if (!found) return { ok: false, reason: "invalid" };
  const { topic } = found;

  const message = clean(input.message, INQUIRY_LIMITS.message, true);
  const contact = topic.contact === "none" ? null : clean(input.contact, INQUIRY_LIMITS.contact);
  const storeName = topic.store === "name" ? clean(input.storeName, INQUIRY_LIMITS.storeName) : null;
  const link = topic.store === "name" ? clean(input.link, INQUIRY_LIMITS.link) : null;
  let storeId: number | null = null;
  if (topic.store === "pick") {
    const id = Number(input.storeId);
    // 고른 책방이 실제로 보이는 책방인지 확인한다(숨긴 책방·없는 번호는 받지 않음)
    if (!Number.isSafeInteger(id) || id <= 0 || !(await getStore(id))) return { ok: false, reason: "invalid" };
    storeId = id;
  }

  if (topic.message === "required" && !message) return { ok: false, reason: "invalid" };
  if (topic.contact === "required" && !contact) return { ok: false, reason: "invalid" };
  if (topic.store === "name" && !storeName) return { ok: false, reason: "invalid" };

  try {
    const ipHash = await clientIpHash();
    const { visitorId } = await getTrackContext();
    if (await tooMany(ipHash)) return { ok: false, reason: "too_many" };

    const { error } = await db().from("inquiries").insert({
      category: found.category.key,
      topic: topic.key,
      store_id: storeId,
      store_name: storeName,
      link,
      message,
      contact,
      ip_hash: ipHash,
      visitor_id: visitorId.slice(0, 64),
    });
    if (error) throw new Error(error.message);
    await cleanupReportData();
    return { ok: true };
  } catch (e) {
    console.error("[owl] inquiry failed", e);
    return { ok: false, reason: "failed" };
  }
}

function clean(v: unknown, max: number, multiline = false): string | null {
  if (typeof v !== "string") return null;
  // 줄바꿈(여러 줄 칸만)·탭 말고 눈에 안 보이는 제어 문자는 뺀다
  let s = v.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  if (!multiline) s = s.replace(/\s+/g, " ");
  s = s.trim().slice(0, max);
  return s || null;
}

async function tooMany(ipHash: string): Promise<boolean> {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  const base = () => db().from("inquiries").select("id", { count: "exact", head: true });
  const [tenMin, day, all] = await Promise.all([
    count(base().eq("ip_hash", ipHash).gte("created_at", ago(10 * 60_000))),
    count(base().eq("ip_hash", ipHash).gte("created_at", ago(24 * 3600_000))),
    count(base().gte("created_at", ago(3600_000))),
  ]);
  return tenMin >= LIMITS.per10min || day >= LIMITS.perDay || all >= LIMITS.allPerHour;
}
