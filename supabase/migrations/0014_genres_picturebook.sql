-- 장르 목록 바꾸기: '그림책' 추가, 순서를 문학·에세이·그림책·인문·사회·과학·예술·기타 로
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

insert into genres (name, sort_order)
select name, ord from unnest(array['문학', '에세이', '그림책', '인문', '사회', '과학', '예술', '기타']) with ordinality as t(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order;
