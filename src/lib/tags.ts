// 첫 화면 장르·모임방식 필터 (서버·브라우저 함께 씀)
// 모임의 tag_genre·tag_format 칸에 적는 이름과 똑같이 맞춘다
// DB의 목록 표(supabase/migrations/0006_tags.sql)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

export const GENRES = ["문학", "인문", "사회", "과학", "에세이", "예술", "기타"] as const;
export const FORMATS = ["발제", "낭독", "자유토론", "필사", "북토크", "기타"] as const;

export type Genre = (typeof GENRES)[number];
export type Format = (typeof FORMATS)[number];

export function isGenre(v: unknown): v is Genre {
  return (GENRES as readonly unknown[]).includes(v);
}

export function isFormat(v: unknown): v is Format {
  return (FORMATS as readonly unknown[]).includes(v);
}
