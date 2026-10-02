"use client";

import { track } from "@/lib/track-client";

// 정보 오류·마감 신고: 오늘은 외부 구글폼. 폼 주소의 {id}, {title} 자리에 모임 정보를 미리 채운다.
export function ReportLink({ meetingId, storeId, title }: { meetingId: number; storeId: number; title: string }) {
  const template = process.env.NEXT_PUBLIC_REPORT_FORM_URL;
  if (!template) return null;
  const href = template.replace("{id}", String(meetingId)).replace("{title}", encodeURIComponent(title));
  return (
    <a
      href={href}
      onClick={() => track("report_click", { meetingId, storeId })}
      className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-center text-l1 font-semibold text-ink-2 hover:bg-sub"
    >
      정보 오류·마감 신고
    </a>
  );
}
