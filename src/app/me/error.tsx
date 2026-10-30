"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// 마이페이지(찜·내 모임·기록·설정)를 불러오다 문제가 생겼을 때
export default function MeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={retry}
      title="마이페이지를 불러오지 못했어요"
      body="찜과 기록은 그대로 있어요. 잠시 뒤 다시 시도해 주세요."
      back={{ href: "/", label: "홈으로" }}
    />
  );
}
