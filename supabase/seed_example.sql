-- 예시 데이터(로컬·배포 직후 화면 확인용). 실제 데이터 입력 후에는 아래 두 줄로 지우세요.
--   delete from meetings where title like '[예시]%';
--   delete from stores where name like '[예시]%';

insert into stores (name, region, is_cooperative) values
  ('[예시] 부엉이책방', '경기 고양시', true),
  ('[예시] 골목서점', '서울 마포구', false);

insert into meetings (store_id, starts_at, title, tag_genre, tag_format, tag_cadence, post_url, apply_url, book_title_text, book_author_text, fee_text)
select id, now() + interval '2 days', '[예시] 목요 소설 읽기', '문학', '토론', '정기',
       'https://instagram.com/', 'https://forms.gle/example', '작별하지 않는다', '한강', '1만5천원'
from stores where name = '[예시] 부엉이책방';

insert into meetings (store_id, starts_at, title, tag_genre, tag_format, tag_cadence, apply_url, book_title_text, book_author_text)
select id, now() + interval '9 days', '[예시] 과학책 한 권 끝내기', '과학', '토론', '일일',
       'https://forms.gle/example2', '코스모스', '칼 세이건'
from stores where name = '[예시] 골목서점';
