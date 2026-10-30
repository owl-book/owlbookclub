"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 운영자 화면(승인 대기·신고함·책 표지·알림·통계)을 불러오다 문제가 생겼을 때
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={retry}
      title="운영자 화면을 불러오지 못했어요"
      body="잠시 뒤 다시 시도해 주세요. 손님 화면에는 영향이 없어요."
      back={{ href: "/admin/review", label: "승인 대기로" }}
    />
  );
}
