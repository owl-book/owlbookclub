// 신고 종류 (신고 창과 관리자 신고함이 함께 쓴다. DB reports.kind 와 같은 값)
export const REPORT_KINDS = [
  { key: "closed", label: "신청이 마감됐어요" },
  { key: "schedule", label: "일정이 달라요" },
  { key: "place_fee", label: "장소·참가비가 달라요" },
  { key: "other", label: "다른 내용이에요" },
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number]["key"];

export const REPORT_MESSAGE_MAX = 500;

export function isReportKind(v: unknown): v is ReportKind {
  return REPORT_KINDS.some((k) => k.key === v);
}

export function reportKindLabel(kind: string): string {
  return REPORT_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export type ReportResult = { ok: true } | { ok: false; reason: "too_many" | "invalid" | "failed" };
