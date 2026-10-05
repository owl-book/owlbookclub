"use client";

import { useSearchParams } from "next/navigation";

// 주소에 검색어나 필터가 있으면 searching을, 없으면 normal을 보여준다.
// 홈 화면과 불러오는 중 화면이 같은 기준으로 '결과 보기 모드'를 고르도록 쓴다(기준은 홈 page.tsx의 searching과 같다).
export function SearchModeSwitch({ normal, searching }: { normal: React.ReactNode; searching: React.ReactNode }) {
  const sp = useSearchParams();
  const isSearching = ["q", "sido", "genre", "format"].some((k) => sp.get(k)?.trim());
  return <>{isSearching ? searching : normal}</>;
}
