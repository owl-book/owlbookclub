import type { ApplyMethod } from "@/lib/meetings";

// 문자로 신청받는 모임: 신청 주소를 'sms:01012345678' 로 넣는다. 맞으면 보여 줄 번호(010-1234-5678)를, 아니면 null
export function smsNumber(applyUrl: string): string | null {
  const m = /^sms:(\+?\d{9,13})/i.exec(applyUrl.trim());
  if (!m) return null;
  const d = m[1];
  if (/^01\d{8,9}$/.test(d)) return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return d;
}

// 신청 버튼 글자
export function applyLabel(method: ApplyMethod, applyUrl: string): string {
  if (method === "dm") return "인스타 DM으로 신청하기 ↗";
  if (smsNumber(applyUrl)) return "문자로 신청하기 ↗";
  return "책방에서 신청하기 ↗";
}
