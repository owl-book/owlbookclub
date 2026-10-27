-- 모임 '표지 그림' 칸 추가: 승인 화면(/admin/review)의 [내용 고치기]에서 부엉이 그림을 직접 고른다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0028 다음에 실행)
-- 쓰는 법: cover_art 에 아래 이름 중 하나를 넣는다. 비워 두면(null) 지금처럼 자동으로 고른다
--   (책 제목이 있으면 책 표지, 없으면 글쓰기·보드게임·플리마켓·기본 그림 순).
--   고른 그림은 책 표지보다 먼저 보인다. 그림 파일은 web/public/meeting-art/<이름>.webp
--   writing 글쓰기 / boardgame 보드게임 / fleamarket 플리마켓 / default 책 읽는 부엉이(기본)
alter table meetings add column if not exists cover_art text;

-- 그림 파일이 없는 이름이 들어가 카드가 빈칸이 되지 않게 막는다
alter table meetings drop constraint if exists meetings_cover_art_check;
alter table meetings add constraint meetings_cover_art_check check (cover_art is null or cover_art in ('writing', 'boardgame', 'fleamarket', 'default'));
