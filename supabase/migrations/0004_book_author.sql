-- 모임 카드에 저자 표시: 책 제목처럼 모임마다 저자를 직접 적는 칸
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
alter table meetings add column if not exists book_author_text text;  -- 선택: 저자(게재 시 입력한 텍스트)

-- 예시 모임 저자 채우기(예시 데이터가 없으면 아무 일도 일어나지 않음)
update meetings set book_author_text = '한강'     where title like '[예시]%' and book_title_text = '작별하지 않는다';
update meetings set book_author_text = '칼 세이건' where title like '[예시]%' and book_title_text = '코스모스';
