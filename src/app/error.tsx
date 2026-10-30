"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 페이지를 불러오다 문제가 생겼을 때(운영자 화면·내 서재는 각자 따로 있다)
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={retry}
      title="잠깐 문제가 생겼어요"
      body="잠시 뒤 다시 시도해 주세요. 계속 안 되면 알려주세요."
      back={{ href: "/", label: "홈으로" }}
    />
  );
}
