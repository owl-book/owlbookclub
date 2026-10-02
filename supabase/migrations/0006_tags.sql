-- 장르·모임방식 목록 표: 모임의 tag_genre·tag_format 은 이 표에 있는 이름만 넣을 수 있다 → 오타 방지
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

create table if not exists genres (
  name        text primary key,   -- 예: '문학'
  sort_order  int  not null
);
create table if not exists formats (
  name        text primary key,   -- 예: '발제'
  sort_order  int  not null
);
alter table genres  enable row level security;
alter table formats enable row level security;

insert into genres (name, sort_order)
select name, ord from unnest(array['문학', '인문', '사회', '과학', '에세이', '예술', '기타']) with ordinality as t(name, ord)
on conflict (name) do nothing;

insert into formats (name, sort_order)
select name, ord from unnest(array['발제', '낭독', '자유토론', '필사', '북토크', '기타']) with ordinality as t(name, ord)
on conflict (name) do nothing;

-- 이미 들어간 모임의 사소한 차이는 자동으로 맞춘다: 띄어쓰기 없애기('자유 토론' → '자유토론')
update meetings set tag_genre  = regexp_replace(tag_genre,  '\s+', '', 'g') where tag_genre  ~ '\s';
update meetings set tag_format = regexp_replace(tag_format, '\s+', '', 'g') where tag_format ~ '\s';

-- 그래도 목록에 없는 장르·모임방식(오타 등)이 남아 있으면 여기서 멈추고 어느 모임인지 알려 준다.
-- 표 편집기에서 그 모임을 고친 뒤 이 파일을 다시 Run 하면 된다.
do $$
declare
  bad text;
begin
  select string_agg(line, E'\n' order by id)
    into bad
  from (
    select id, format('[모임 번호 %s] %s → 장르 ''%s''', id, title, tag_genre) as line
    from meetings where tag_genre not in (select name from genres)
    union all
    select id, format('[모임 번호 %s] %s → 모임방식 ''%s''', id, title, tag_format)
    from meetings where tag_format not in (select name from formats)
  ) t;

  if bad is not null then
    raise exception E'목록에 없는 장르·모임방식이 적힌 모임이 있어요. 아래 모임을 고친 뒤 다시 실행해 주세요.\n(장르: 문학 인문 사회 과학 에세이 예술 기타 / 모임방식: 발제 낭독 자유토론 필사 북토크 기타)\n%', bad;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'meetings_tag_genre_fkey') then
    alter table meetings
      add constraint meetings_tag_genre_fkey foreign key (tag_genre) references genres(name) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'meetings_tag_format_fkey') then
    alter table meetings
      add constraint meetings_tag_format_fkey foreign key (tag_format) references formats(name) on update cascade;
  end if;
end $$;
