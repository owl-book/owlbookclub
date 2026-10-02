-- 지역 목록 표: 책방 지역(stores.region)은 이 표에 있는 이름만 넣을 수 있다 → 오타 방지
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 지역 드롭박스(src/lib/regions.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

create table if not exists regions (
  name        text primary key,          -- 책방 지역 칸에 들어가는 이름. 예: '서울 마포구'
  sido        text not null check (sido in ('서울', '경기')),
  sigungu     text not null,             -- 예: '마포구', '고양시', '가평군'
  sort_order  int  not null,
  unique (sido, sigungu)
);
alter table regions enable row level security;

insert into regions (name, sido, sigungu, sort_order)
select sido || ' ' || sigungu, sido, sigungu, ord
from (
  select '서울' as sido, sigungu, ord from unnest(array[
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구',
    '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구',
    '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
  ]) with ordinality as t(sigungu, ord)
  union all
  select '경기', sigungu, 100 + ord from unnest(array[
    '가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시',
    '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시',
    '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시',
    '평택시', '포천시', '하남시', '화성시'
  ]) with ordinality as t(sigungu, ord)
) s
on conflict (name) do nothing;

-- 이미 들어간 책방 지역의 사소한 차이는 자동으로 맞춘다
--   앞뒤·중복 띄어쓰기 정리, '서울특별시'·'서울시' → '서울', '경기도' → '경기'
update stores
set region = regexp_replace(
               regexp_replace(regexp_replace(trim(region), '\s+', ' ', 'g'), '^서울(특별시|시)\s*', '서울 '),
               '^경기도\s*', '경기 ')
where region is distinct from regexp_replace(
               regexp_replace(regexp_replace(trim(region), '\s+', ' ', 'g'), '^서울(특별시|시)\s*', '서울 '),
               '^경기도\s*', '경기 ');

-- 그래도 목록에 없는 지역(오타 등)이 남아 있으면 여기서 멈추고 어느 책방인지 알려 준다.
-- 표 편집기에서 그 책방의 지역을 고친 뒤 이 파일을 다시 Run 하면 된다.
do $$
declare
  bad text;
begin
  select string_agg(format('[책방 번호 %s] %s → 지역 ''%s''', id, name, region), E'\n' order by id)
    into bad
  from stores
  where region not in (select name from regions);

  if bad is not null then
    raise exception E'목록에 없는 지역이 적힌 책방이 있어요. 아래 책방의 지역을 고친 뒤 다시 실행해 주세요.\n%', bad;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stores_region_fkey') then
    alter table stores
      add constraint stores_region_fkey foreign key (region) references regions(name) on update cascade;
  end if;
end $$;
