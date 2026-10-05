-- 모임방식 목록 바꾸기: 발제·자유토론 → '토론' 하나로 합치고, '함께읽기'·'글쓰기' 추가
-- (인스타 게시물만으로는 발제인지 자유토론인지 가리기 어려운 경우가 많아서)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

-- 1) 새 이름 넣고, 순서를 새 목록대로 맞추기
insert into formats (name, sort_order)
select name, ord from unnest(array['토론', '함께읽기', '낭독', '필사', '글쓰기', '북토크', '기타']) with ordinality as t(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order;

-- 2) 이미 올라간 모임 옮기기: 발제·자유토론 → 토론
update meetings set tag_format = '토론' where tag_format in ('발제', '자유토론');

-- 3) 안 쓰는 이름 지우기
delete from formats where name in ('발제', '자유토론');
