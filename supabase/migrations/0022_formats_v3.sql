-- 모임방식 목록에 '원서읽기'·'책놀이' 추가
-- (영어원서 모임과 그림책 놀이 모임이 함께읽기·기타에 섞여 있어서 따로 찾을 수 있게)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

-- 새 이름 넣고, 순서를 새 목록대로 맞추기
insert into formats (name, sort_order)
select name, ord from unnest(array['토론', '함께읽기', '원서읽기', '낭독', '필사', '글쓰기', '북토크', '책놀이', '기타']) with ordinality as t(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order;
