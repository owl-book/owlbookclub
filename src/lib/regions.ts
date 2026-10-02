// 첫 화면 지역 필터: 시·도 → 구·시·군 (서버·브라우저 함께 씀)
// 책방 지역(stores.region)은 '서울 마포구', '경기 고양시'처럼 "시·도 구·시·군" 띄어쓰기로 적는다
// DB의 지역 목록 표(supabase/migrations/0005_regions.sql)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

export const REGIONS = {
  서울: [
    "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구",
    "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구",
    "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구",
  ],
  경기: [
    "가평군", "고양시", "과천시", "광명시", "광주시", "구리시", "군포시", "김포시", "남양주시",
    "동두천시", "부천시", "성남시", "수원시", "시흥시", "안산시", "안성시", "안양시", "양주시",
    "양평군", "여주시", "연천군", "오산시", "용인시", "의왕시", "의정부시", "이천시", "파주시",
    "평택시", "포천시", "하남시", "화성시",
  ],
} as const;

export type Sido = keyof typeof REGIONS;

export const SIDOS = Object.keys(REGIONS) as Sido[];

export function isSido(v: unknown): v is Sido {
  return typeof v === "string" && v in REGIONS;
}

export function isGuOf(sido: Sido, v: unknown): v is string {
  return typeof v === "string" && (REGIONS[sido] as readonly string[]).includes(v);
}

// sido 없으면 전체, gu 없으면 시·도 전체
export function matchesRegion(region: string, sido: Sido | null, gu: string | null): boolean {
  if (!sido) return true;
  const [first, second] = region.trim().split(/\s+/);
  if (!first?.startsWith(sido)) return false; // '서울특별시'처럼 적어도 맞도록
  return !gu || second === gu;
}
