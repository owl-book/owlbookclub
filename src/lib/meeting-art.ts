// 모임 표지 그림(부엉이 그림, public/meeting-art/<이름>.webp, 2:3). 이름 목록은 'DB 표 0029 의 cover_art' 와 같다
export const MEETING_ARTS = [
  ["default", "기본(책 읽는 부엉이)"],
  ["writing", "글쓰기"],
  ["boardgame", "보드게임"],
  ["fleamarket", "플리마켓"],
] as const;

export type MeetingArt = (typeof MEETING_ARTS)[number][0];

export function isMeetingArt(v: unknown): v is MeetingArt {
  return MEETING_ARTS.some(([k]) => k === v);
}

export function meetingArtSrc(art: MeetingArt): string {
  return `/meeting-art/${art}.webp`;
}

// 고른 그림이 없을 때(자동): 글쓰기는 모임 방식으로, 보드게임·플리마켓은 따로 방식이 없어(기타) 모임 이름으로 고르고,
// 나머지는 책 읽는 부엉이 기본 그림
export function autoMeetingArt(m: { tagFormat: string; title: string }): MeetingArt {
  if (m.tagFormat === "글쓰기") return "writing";
  if (m.title.includes("보드게임")) return "boardgame";
  if (m.title.includes("플리마켓")) return "fleamarket";
  return "default";
}
