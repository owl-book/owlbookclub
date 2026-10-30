-- 시험용 DB 설치 파일: 변경 파일 0001~0031 을 순서대로 합친 것 (2026-10-30)
-- 쓰는 곳: 새로 만든 '시험용' Supabase 프로젝트의 SQL Editor 에 통째로 붙여넣고 Run. 실제 DB에는 실행하지 말 것.
-- 0032 부터의 새 변경 파일은 이 파일에 넣지 않고, 시험용 → 실제 순서로 따로 실행한다.


-- ═══════════ 0001_init.sql ═══════════
-- 부엉이서재 MVP 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
-- 모든 테이블은 RLS를 켜고 정책을 두지 않는다 → 브라우저(anon)에서는 접근 불가, 서버(service role)만 읽고 쓴다.

-- ─────────────────────────────────────────────
-- 책방
-- ─────────────────────────────────────────────
create table if not exists stores (
  id              bigint generated always as identity primary key,
  name            text not null,
  region          text not null,                 -- 예: '서울 마포구', '경기 고양시'
  is_cooperative  boolean not null default false,-- 협조 책방 여부
  is_blocked      boolean not null default false,-- 삭제 요청 시 true → 모든 모임 비노출, 재게재 방지
  instagram_url   text,
  memo            text,                          -- 운영 메모(비공개)
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 책 (알라딘 API/직접 입력. 검색에는 쓰지 않는 내부 데이터 — 다음 주부터 사용)
-- ─────────────────────────────────────────────
create table if not exists books (
  isbn        text primary key,
  title       text not null,
  author      text,
  publisher   text,
  source      text not null default 'manual' check (source in ('aladin', 'manual')),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 모임
-- '지난 모임'은 저장하지 않는다. starts_at < now() 로 조회 시 계산(자동 처리는 이것 하나뿐).
-- status 는 운영자가 수동으로 바꾸는 'open' / 'closed'(마감) 만 가진다.
-- ─────────────────────────────────────────────
create table if not exists meetings (
  id               bigint generated always as identity primary key,
  store_id         bigint not null references stores(id),
  starts_at        timestamptz not null,          -- 테이블 편집기에서 '2026-10-08 19:30+09' 형식으로 입력
  title            text not null,
  tag_genre        text not null,                 -- 장르: 문학, 인문, 사회, 과학, 에세이, 예술, 기타 …
  tag_format       text not null,                 -- 모임방식: 목록은 formats 표 (0006·0013)
  tag_cadence      text not null check (tag_cadence in ('정기', '일일')),
  post_url         text,                          -- 원 게시물(인스타 등)
  apply_url        text not null,                 -- 책방 신청 페이지
  book_title_text  text,                          -- 검색 대상 책 제목(게재 시 입력한 텍스트)
  book_isbn        text references books(isbn),
  place            text,                          -- 선택: 장소 보충 설명
  fee_text         text,                          -- 선택: 참가비 표기(예: '2만원(음료 포함)')
  last_checked_at  date not null default (now() at time zone 'Asia/Seoul')::date,
  status           text not null default 'open' check (status in ('open', 'closed')),
  created_at       timestamptz not null default now()
);
create index if not exists meetings_starts_at_idx on meetings (starts_at);

-- ─────────────────────────────────────────────
-- 이벤트 로그 (측정의 원천 데이터)
-- ─────────────────────────────────────────────
create table if not exists events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  visitor_id    text not null,
  session_id    text not null,
  type          text not null check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click')),
  meeting_id    bigint,
  store_id      bigint,
  path          text,
  props         jsonb not null default '{}'::jsonb,  -- 검색어, 필터값, 공유 방식 등
  utm_source    text,                                 -- 첫 유입(first-touch) 값. 없으면 'direct'
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  referrer      text,
  user_agent    text,
  is_bot        boolean not null default false,
  is_internal   boolean not null default false        -- 운영자 기기(?owl_internal=1)
);
create index if not exists events_type_created_idx on events (type, created_at);
create index if not exists events_visitor_idx on events (visitor_id, created_at);

alter table stores   enable row level security;
alter table books    enable row level security;
alter table meetings enable row level security;
alter table events   enable row level security;

-- ═════════════════════════════════════════════
-- 지표 뷰 (5장 성공 기준 측정용). 모두 봇·내부 트래픽 제외. 월은 KST 기준.
-- ═════════════════════════════════════════════

-- 집계용 기본 이벤트
create or replace view v_events_clean as
select e.*,
       to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       (e.created_at at time zone 'Asia/Seoul')::date            as day_kst
from events e
where not e.is_bot and not e.is_internal;

-- H1: 월 순방문자
create or replace view v_monthly_visitors as
select month_kst, count(distinct visitor_id) as unique_visitors, count(*) filter (where type = 'visit') as sessions
from v_events_clean
group by 1 order by 1;

-- H1 핵심: 4주 내 재방문율
-- 대상: 오픈(2026-10-01 KST) 후 첫 8주 안에 처음 방문한 방문자 중, 첫 방문 후 28일이 지나 판정 가능한 사람.
-- 재방문: 첫 방문일 이후 '다른 날(KST)'에 다시 visit 이 발생. (같은 날 30분 뒤 재접속은 재방문으로 치지 않음 — 보수적 기준)
create or replace view v_retention_4w as
with firsts as (
  select visitor_id, min(created_at) as first_at, min(day_kst) as first_day
  from v_events_clean where type = 'visit' group by 1
), cohort as (
  select * from firsts
  where first_at <  timestamptz '2026-10-01 00:00+09' + interval '8 weeks'
    and first_at <= now() - interval '28 days'
)
select count(*) as cohort_size,
       count(*) filter (where exists (
         select 1 from v_events_clean v
         where v.visitor_id = c.visitor_id and v.type = 'visit'
           and v.day_kst > c.first_day and v.created_at <= c.first_at + interval '28 days'
       )) as returned,
       round(100.0 * count(*) filter (where exists (
         select 1 from v_events_clean v
         where v.visitor_id = c.visitor_id and v.type = 'visit'
           and v.day_kst > c.first_day and v.created_at <= c.first_at + interval '28 days'
       )) / nullif(count(*), 0), 1) as rate_pct
from cohort c;

-- H1 보조: 8주 내 재방문율 (오픈 후 첫 4주 안의 첫 방문자)
create or replace view v_retention_8w as
with firsts as (
  select visitor_id, min(created_at) as first_at, min(day_kst) as first_day
  from v_events_clean where type = 'visit' group by 1
), cohort as (
  select * from firsts
  where first_at <  timestamptz '2026-10-01 00:00+09' + interval '4 weeks'
    and first_at <= now() - interval '56 days'
), flagged as (
  select c.*, exists (
    select 1 from v_events_clean v
    where v.visitor_id = c.visitor_id and v.type = 'visit'
      and v.day_kst > c.first_day and v.created_at <= c.first_at + interval '56 days'
  ) as returned
  from cohort c
)
select count(*) as cohort_size, count(*) filter (where returned) as returned,
       round(100.0 * count(*) filter (where returned) / nullif(count(*), 0), 1) as rate_pct
from flagged;

-- 판정 전 추이를 보기 위한 잠정 재방문율(28일 미경과 방문자 포함 — 판정에 쓰지 않음)
create or replace view v_retention_4w_provisional as
with firsts as (
  select visitor_id, min(created_at) as first_at, min(day_kst) as first_day
  from v_events_clean where type = 'visit' group by 1
)
select to_char(first_at at time zone 'Asia/Seoul', 'IYYY-"W"IW') as first_week,
       count(*) as new_visitors,
       count(*) filter (where exists (
         select 1 from v_events_clean v
         where v.visitor_id = f.visitor_id and v.type = 'visit'
           and v.day_kst > f.first_day and v.created_at <= f.first_at + interval '28 days'
       )) as returned_so_far
from firsts f group by 1 order by 1;

-- H1: 검색·날짜 필터 사용 비율(방문자 대비, 월별)
create or replace view v_search_filter_rate as
select month_kst,
       count(distinct visitor_id) as visitors,
       count(distinct visitor_id) filter (where type in ('search', 'filter')) as search_or_filter_users,
       round(100.0 * count(distinct visitor_id) filter (where type in ('search', 'filter'))
             / nullif(count(distinct visitor_id), 0), 1) as rate_pct
from v_events_clean group by 1 order by 1;

-- H1 잠재력: 유입 채널 비중(월별, 방문자 첫 유입 기준). direct·share 비중이 늘어나는지 본다.
create or replace view v_channel_mix as
with per_visitor as (
  select distinct on (month_kst, visitor_id) month_kst, visitor_id, coalesce(utm_source, 'direct') as channel
  from v_events_clean order by month_kst, visitor_id, created_at
)
select month_kst, channel, count(*) as visitors,
       round(100.0 * count(*) / sum(count(*)) over (partition by month_kst), 1) as share_pct
from per_visitor group by 1, 2 order by 1, 3 desc;

-- H2/리포트: 신청 클릭(같은 세션·같은 모임은 1회)
create or replace view v_apply_clicks_by_meeting_store as
select c.month_kst, s.id as store_id, s.name as store_name, s.is_cooperative,
       m.id as meeting_id, m.title as meeting_title, m.starts_at,
       count(*) as raw_clicks,
       count(distinct c.session_id) as unique_clicks
from v_events_clean c
join meetings m on m.id = c.meeting_id
join stores s on s.id = m.store_id
where c.type = 'apply_click'
group by 1, 2, 3, 4, 5, 6, 7
order by 1, 3, 7;

-- 협조 책방 월간 리포트(찜 수는 다음 주 찜 기능 추가 후 컬럼 추가)
create or replace view v_store_monthly_report as
select month_kst, store_id, store_name,
       count(distinct meeting_id) as meetings_clicked,
       sum(unique_clicks)         as unique_apply_clicks
from v_apply_clicks_by_meeting_store
where is_cooperative
group by 1, 2, 3 order by 1, 3;

-- H1 잠재력: 두 곳 이상 책방을 클릭한 비율(신청 클릭 사용자 기준. 로그인 후엔 찜 포함으로 확장)
create or replace view v_multi_store_rate as
with per_visitor as (
  select visitor_id, count(distinct store_id) as stores
  from v_events_clean where type = 'apply_click' and store_id is not null group by 1
)
select count(*) as clickers,
       count(*) filter (where stores >= 2) as multi_store_clickers,
       round(100.0 * count(*) filter (where stores >= 2) / nullif(count(*), 0), 1) as rate_pct
from per_visitor;

-- 게이트 2: 월 게재 모임 수(모임 일시 기준 월, 차단 책방 제외)
create or replace view v_monthly_listed_meetings as
select to_char(m.starts_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       count(*) as meetings,
       count(*) filter (where s.is_cooperative) as cooperative_meetings
from meetings m join stores s on s.id = m.store_id
where not s.is_blocked
group by 1 order by 1;

-- 뷰도 브라우저에서 못 읽게(보안 기본값)
revoke all on v_events_clean, v_monthly_visitors, v_retention_4w, v_retention_8w, v_retention_4w_provisional,
  v_search_filter_rate, v_channel_mix, v_apply_clicks_by_meeting_store, v_store_monthly_report,
  v_multi_store_rate, v_monthly_listed_meetings from anon, authenticated;


-- ═══════════ 0002_auth.sql ═══════════
-- 간편 로그인(구글·네이버·카카오)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0001 다음에 실행)
-- 수집 항목 최소화: 로그인 회사, 그 회사의 회원 고유번호, 별명만 저장한다.

create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null check (provider in ('google', 'naver', 'kakao')),
  provider_user_id  text not null,
  nickname          text,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz not null default now(),
  unique (provider, provider_user_id)
);
alter table users enable row level security;

-- 이벤트에 로그인 사용자 표시(비로그인은 비어 있음) + 'login' 이벤트 추가
alter table events add column if not exists user_id uuid;
create index if not exists events_user_idx on events (user_id, created_at) where user_id is not null;

alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login'));

-- 월별 로그인 사용자 수 · 신규 가입 수
create or replace view v_monthly_login_users as
-- (기존 v_events_clean 은 칸 순서 때문에 고치지 않고, events 를 직접 읽는다)
select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       count(distinct user_id) as login_users,
       count(*) filter (where type = 'login' and (props->>'new_user')::boolean) as new_users
from events
where user_id is not null and not is_bot and not is_internal
group by 1 order by 1;

revoke all on v_monthly_login_users from anon, authenticated;


-- ═══════════ 0003_mypage.sql ═══════════
-- 마이페이지: 찜(책방·모임), 다녀온 모임 기록, 별명 바꾸기
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0002 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 서버만 읽고 쓴다. 기록은 서버에서 '본인 것만' 꺼낸다.

-- 사용자가 직접 정한 별명(없으면 로그인한 회사의 별명을 쓴다)
alter table users add column if not exists display_name text;

-- ─────────────────────────────────────────────
-- 찜: 회원 탈퇴(users 삭제) 시 함께 지워진다
-- ─────────────────────────────────────────────
create table if not exists store_wishes (
  user_id     uuid not null references users(id) on delete cascade,
  store_id    bigint not null references stores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index if not exists store_wishes_store_idx on store_wishes (store_id, created_at);

create table if not exists meeting_wishes (
  user_id     uuid not null references users(id) on delete cascade,
  meeting_id  bigint not null references meetings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, meeting_id)
);
create index if not exists meeting_wishes_meeting_idx on meeting_wishes (meeting_id, created_at);

-- ─────────────────────────────────────────────
-- 다녀온 모임 기록(비공개). 모임 하나에 기록 하나.
-- ─────────────────────────────────────────────
create table if not exists meeting_records (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references users(id) on delete cascade,
  meeting_id  bigint not null references meetings(id) on delete cascade,
  rating      smallint check (rating between 1 and 5),   -- 나만 보는 만족도(선택)
  quote       text check (char_length(quote) <= 500),    -- 인상 깊은 문장(선택)
  memo        text check (char_length(memo) <= 5000),    -- 자유 메모(선택)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, meeting_id)
);

alter table store_wishes    enable row level security;
alter table meeting_wishes  enable row level security;
alter table meeting_records enable row level security;

-- 이벤트에 '찜'(props: target=meeting|store, on=true|false), '기록 저장' 추가
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record'));

-- ═════════════════════════════════════════════
-- 지표 뷰
-- ═════════════════════════════════════════════

-- 협조 책방 월간 리포트용 찜 수(월은 찜한 날 KST 기준. 지금 남아 있는 찜만 센다)
create or replace view v_store_wishes_monthly as
with w as (
  select sw.store_id, sw.created_at, 'store' as kind from store_wishes sw
  union all
  select m.store_id, mw.created_at, 'meeting' as kind from meeting_wishes mw join meetings m on m.id = mw.meeting_id
)
select to_char(w.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       s.id as store_id, s.name as store_name, s.is_cooperative,
       count(*) filter (where kind = 'store')   as store_wishes,
       count(*) filter (where kind = 'meeting') as meeting_wishes
from w join stores s on s.id = w.store_id
group by 1, 2, 3, 4 order by 1, 3;

-- 누적 저장 사용자(찜 또는 기록이 하나라도 있는 회원)와, 그중 두 곳 이상 책방을 찜하거나 신청 클릭한 비율(목표 30%)
create or replace view v_saved_users as
with saved as (
  select user_id from store_wishes
  union select user_id from meeting_wishes
  union select user_id from meeting_records
), touched as (
  select user_id, store_id from store_wishes
  union select mw.user_id, m.store_id from meeting_wishes mw join meetings m on m.id = mw.meeting_id
  union select user_id, store_id from events
    where type = 'apply_click' and user_id is not null and store_id is not null and not is_bot and not is_internal
), per_user as (
  select s.user_id, count(distinct t.store_id) as stores
  from saved s left join touched t on t.user_id = s.user_id
  group by 1
)
select count(*) as saved_users,
       count(*) filter (where stores >= 2) as multi_store_users,
       round(100.0 * count(*) filter (where stores >= 2) / nullif(count(*), 0), 1) as multi_store_rate_pct
from per_user;

revoke all on v_store_wishes_monthly, v_saved_users from anon, authenticated;


-- ═══════════ 0004_book_author.sql ═══════════
-- 모임 카드에 저자 표시: 책 제목처럼 모임마다 저자를 직접 적는 칸
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
alter table meetings add column if not exists book_author_text text;  -- 선택: 저자(게재 시 입력한 텍스트)

-- 예시 모임 저자 채우기(예시 데이터가 없으면 아무 일도 일어나지 않음)
update meetings set book_author_text = '한강'     where title like '[예시]%' and book_title_text = '작별하지 않는다';
update meetings set book_author_text = '칼 세이건' where title like '[예시]%' and book_title_text = '코스모스';


-- ═══════════ 0005_regions.sql ═══════════
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


-- ═══════════ 0006_tags.sql ═══════════
-- 장르·모임방식 목록 표: 모임의 tag_genre·tag_format 은 이 표에 있는 이름만 넣을 수 있다 → 오타 방지
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.
-- ※ 모임방식 목록은 0013_formats_v2.sql 에서 바뀌었다(발제·자유토론 → 토론, 함께읽기·글쓰기 추가). 이 파일은 0013 전에만 실행할 것.
-- ※ 장르 목록은 0014_genres_picturebook.sql 에서 바뀌었다(그림책 추가, 순서 변경).

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


-- ═══════════ 0007_store_address.sql ═══════════
-- 책방 주소 칸 추가: 모임 상세화면 '장소' 줄에 주소와 지도 열기 링크를 보여 준다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 주소는 도로명 주소로 적는다(예: '경기 고양시 일산동구 정발산로 24 2층'). 비워 두면 화면에 '책방 신청 페이지에서 확인'으로 보인다.

alter table stores add column if not exists address text;


-- ═══════════ 0008_meeting_description.sql ═══════════
-- 모임 소개 칸 추가: 모임 상세화면 일시·장소 카드 아래 '모임 소개'에 보여 준다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 1000자까지. 비워 두면 화면에 나오지 않는다.
-- 쓰는 법(줄바꿈은 그대로 보인다):
--   빈 줄         → 문단 나누기
--   '- ' 또는 '* ' 로 시작 → 점 목록(•)  예: '- 음료 1잔 포함', '* 음료 1잔 포함'
--   '1. ' 로 시작          → 번호 목록(1. 2.)  예: '1. 자기소개'

alter table meetings add column if not exists description text;

alter table meetings drop constraint if exists meetings_description_length;
alter table meetings add constraint meetings_description_length check (char_length(description) <= 1000);



-- ═══════════ 0009_meeting_plans.sql ═══════════
-- 내 모임: 찜 → 책방에서 신청했어요 → 다녀왔어요(또는 못 갔어요)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0008 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 서버만 읽고 쓴다.
--
-- 원칙(계획서 2장 '내 모임 원칙')
-- - 부엉이서재는 신청을 받지 않는다. 여기 남는 것은 '본인이 책방에서 신청했다고 표시한 사실'뿐이다.
-- - 개별 표시는 본인만 본다. 책방 리포트에는 합계만, '못 갔어요'는 리포트에 넣지 않는다.
-- - 모임 행은 지우지 않는다(게재 내림은 책방 is_blocked 로 숨김). 아래 외래키를 restrict 로 두어 실수로 지워도 막힌다.

create table if not exists meeting_plans (
  user_id     uuid not null references users(id) on delete cascade,
  meeting_id  bigint not null references meetings(id) on delete restrict,
  applied_at  timestamptz,                                       -- '책방에서 신청했어요'를 누른 시각(없으면 신청 표시 없이 다녀옴만 표시)
  owl_noted   boolean,                                           -- 신청서에 '부엉이'라고 적었다고 답함(선택. 모르면 비어 있음)
  attended    text check (attended in ('yes', 'no')),            -- 모임 뒤 확인: 다녀왔어요 / 못 갔어요. 확인 전엔 비어 있음
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, meeting_id)
);
create index if not exists meeting_plans_meeting_idx on meeting_plans (meeting_id) where applied_at is not null;

alter table meeting_plans enable row level security;

-- 기존 찜·기록도 모임이 지워질 때 함께 사라지지 않도록 restrict 로 바꾼다(사용자 기록 보호)
alter table meeting_wishes  drop constraint if exists meeting_wishes_meeting_id_fkey;
alter table meeting_wishes  add constraint meeting_wishes_meeting_id_fkey  foreign key (meeting_id) references meetings(id) on delete restrict;
alter table meeting_records drop constraint if exists meeting_records_meeting_id_fkey;
alter table meeting_records add constraint meeting_records_meeting_id_fkey foreign key (meeting_id) references meetings(id) on delete restrict;

-- 이벤트에 '내 모임'(props: action=apply|unapply|attend_yes|attend_no, owl_noted) 추가
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan'));

-- ═════════════════════════════════════════════
-- 지표 뷰
-- ═════════════════════════════════════════════

-- 책방 월간 리포트용 '신청 표시' 합계(월은 표시한 날 KST 기준. 지금 남아 있는 표시만 센다)
-- 누가 표시했는지, 다녀왔는지/못 갔는지는 넣지 않는다.
create or replace view v_store_apply_marks_monthly as
select to_char(p.applied_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       s.id as store_id, s.name as store_name, s.is_cooperative,
       count(*)                                  as apply_marks,       -- 부엉이 회원이 '책방에서 신청했어요'를 누른 수
       count(*) filter (where p.owl_noted)       as owl_noted_marks    -- 그중 '부엉이'라고 적었다고 답한 수
from meeting_plans p
join meetings m on m.id = p.meeting_id
join stores s on s.id = m.store_id
where p.applied_at is not null
group by 1, 2, 3, 4 order by 1, 3;

-- H2 점검용: 모임별 신청 클릭 vs 신청 표시(클릭은 세션 중복 제거값)
create or replace view v_apply_marks_vs_clicks as
select c.month_kst, c.store_id, c.store_name, c.is_cooperative, c.meeting_id, c.meeting_title,
       c.unique_clicks,
       (select count(*) from meeting_plans p where p.meeting_id = c.meeting_id and p.applied_at is not null) as apply_marks
from v_apply_clicks_by_meeting_store c;

revoke all on v_store_apply_marks_monthly, v_apply_marks_vs_clicks from anon, authenticated;


-- ═══════════ 0010_meeting_hidden.sql ═══════════
-- 모임 하나만 숨기기 + '부엉이 기입' 질문 삭제
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0009 다음에 실행)

-- ─────────────────────────────────────────────
-- 1) 모임 숨김: 잘못 올렸거나 중복된 모임, 책방이 그 모임만 내려 달라고 한 경우
--    모임은 지우지 않고(사용자의 찜·내 모임·기록 보호) 이 칸을 true 로 바꾼다.
--    숨긴 모임은 목록·상세·검색·신청 링크에서 사라지고, 담아 둔 사용자에게만 글자로 남는다.
--    책방 전체를 내릴 때는 기존처럼 stores.is_blocked 를 쓴다.
-- ─────────────────────────────────────────────
alter table meetings add column if not exists is_hidden boolean not null default false;

-- 게이트 2: 월 게재 모임 수에서 숨긴 모임도 뺀다
create or replace view v_monthly_listed_meetings as
select to_char(m.starts_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       count(*) as meetings,
       count(*) filter (where s.is_cooperative) as cooperative_meetings
from meetings m join stores s on s.id = m.store_id
where not s.is_blocked and not m.is_hidden
group by 1 order by 1;

-- ─────────────────────────────────────────────
-- 2) '신청서에 부엉이라고 적었어요' 질문 삭제(기입을 강요하는 느낌을 주지 않도록)
--    칸을 지우기 전에 그 칸을 쓰는 리포트 뷰를 먼저 지우고 다시 만든다.
-- ─────────────────────────────────────────────
drop view if exists v_store_apply_marks_monthly;
alter table meeting_plans drop column if exists owl_noted;

create view v_store_apply_marks_monthly as
select to_char(p.applied_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       s.id as store_id, s.name as store_name, s.is_cooperative,
       count(*) as apply_marks   -- 부엉이 회원이 '책방에서 신청했어요'를 누른 수(누가 눌렀는지는 넣지 않음)
from meeting_plans p
join meetings m on m.id = p.meeting_id
join stores s on s.id = m.store_id
where p.applied_at is not null
group by 1, 2, 3, 4 order by 1, 3;

revoke all on v_monthly_listed_meetings, v_store_apply_marks_monthly from anon, authenticated;


-- ═══════════ 0011_reports.sql ═══════════
-- 정보 오류·마감 신고를 사이트 안에서 받고, 관리자 신고함(/admin/reports)에서 처리한다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0010 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.

-- ─────────────────────────────────────────────
-- 1) 신고
--    누가 보냈는지는 남기지 않는다. 장난 신고를 막는 데만 쓰는 값(ip_hash, visitor_id)은
--    알아볼 수 없게 바꾼 값이고, 7일 뒤 서버가 비운다. 처리가 끝난 신고는 6개월 뒤 지운다.
-- ─────────────────────────────────────────────
create table if not exists reports (
  id               bigint generated always as identity primary key,
  meeting_id       bigint not null references meetings(id) on delete restrict,
  kind             text not null check (kind in ('closed', 'schedule', 'place_fee', 'other')),
  message          text check (char_length(message) <= 500),
  status           text not null default 'open' check (status in ('open', 'done')),
  resolved_action  text check (resolved_action in ('close', 'hide', 'edit', 'ok')),
  resolved_at      timestamptz,
  ip_hash          text,          -- 보낸 곳(IP)을 되돌릴 수 없게 바꾼 값. 짧은 시간 여러 번 보내기 막기용
  visitor_id       text,          -- 방문자 쿠키값. 같은 용도
  created_at       timestamptz not null default now()
);
create index if not exists reports_open_idx on reports (created_at desc) where status = 'open';
create index if not exists reports_ip_idx on reports (ip_hash, created_at);
create index if not exists reports_meeting_idx on reports (meeting_id);
alter table reports enable row level security;

-- ─────────────────────────────────────────────
-- 2) 관리자 비밀번호 시도 기록(틀린 횟수 세기). 하루 지나면 서버가 지운다
-- ─────────────────────────────────────────────
create table if not exists admin_login_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists admin_login_attempts_idx on admin_login_attempts (created_at, ip_hash);
alter table admin_login_attempts enable row level security;

-- ─────────────────────────────────────────────
-- 3) 관리자 처리 기록: 신고함에서 무엇을 언제 어떻게 바꿨는지(바꾸기 전·후 값). 잘못 바꾸면 이 기록을 보고 되돌린다
-- ─────────────────────────────────────────────
create table if not exists admin_actions (
  id          bigint generated always as identity primary key,
  meeting_id  bigint not null references meetings(id) on delete restrict,
  action      text not null check (action in ('close', 'hide', 'edit', 'ok')),
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_actions_meeting_idx on admin_actions (meeting_id, created_at desc);
alter table admin_actions enable row level security;

revoke all on reports, admin_login_attempts, admin_actions from anon, authenticated;


-- ═══════════ 0012_store_intro.sql ═══════════
-- 책방 상세 화면(/s/책방번호)의 '한 줄 소개'
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0011 다음에 실행)
-- 비워 두면 화면에서 소개 줄만 빠진다. 책방 홍보 문구가 아니라 '어떤 책방인지' 한 줄(40자 안팎)로 적는다.
-- 예: '골목 2층, 소설이 많은 작은 책방'

alter table stores add column if not exists intro text;


-- ═══════════ 0013_formats_v2.sql ═══════════
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


-- ═══════════ 0014_genres_picturebook.sql ═══════════
-- 장르 목록 바꾸기: '그림책' 추가, 순서를 문학·에세이·그림책·인문·사회·과학·예술·기타 로
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

insert into genres (name, sort_order)
select name, ord from unnest(array['문학', '에세이', '그림책', '인문', '사회', '과학', '예술', '기타']) with ordinality as t(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order;


-- ═══════════ 0015_store_hours_phone.sql ═══════════
-- 책방 상세 화면(/s/책방번호)의 '운영시간'·'대표번호'
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0014 다음에 실행)
-- 네이버 플레이스에 적힌 내용을 옮겨 적는다. 화면에 "네이버 플레이스 기준" 안내가 함께 나온다.
-- 비워 두면 화면에서 그 줄만 빠진다.
-- hours: 줄바꿈 그대로 보인다. 화면에서는 줄 맨 앞 요일 기준 월→일 순으로 정렬된다. 예: '월 휴무
-- 화~토 12:00–20:00
-- 일 13:00–18:00'
-- phone: 예: '02-123-4567' (누르면 전화 걸기)

alter table stores add column if not exists hours text;
alter table stores add column if not exists phone text;


-- ═══════════ 0016_inquiries.sql ═══════════
-- 풋바 '의견·요청 보내기'(/contact)로 들어오는 문의를 받고, 관리자 신고함(/admin/reports)에서 처리한다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0015 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
--
-- 종류(category)와 보기(topic)는 앱 파일 src/lib/inquiry-kinds.ts 와 같은 값이다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.
--   info    정보가 달라요            store · meeting · book
--   suggest 새 책방·모임을 알려드려요  new
--   site    그 밖의 문의             bug · account · idea · pause(게시 멈추기·빼기) · other
--
-- 보관: 연락처는 처리를 마친 날로부터 3개월 뒤, 내용은 6개월 뒤 서버가 지운다.
--       여러 번 보내기를 막는 값(ip_hash, visitor_id)은 7일 뒤 비운다.

create table if not exists inquiries (
  id           bigint generated always as identity primary key,
  category     text not null check (category in ('info', 'suggest', 'site')),
  topic        text not null check (topic in ('store', 'meeting', 'book', 'new', 'pause', 'bug', 'account', 'idea', 'other')),
  store_id     bigint references stores(id) on delete set null, -- 사이트에 있는 책방을 고른 경우
  store_name   text check (char_length(store_name) <= 100),    -- 아직 없는 책방 이름(새 책방 알려주기)
  link         text check (char_length(link) <= 300),          -- 인스타·신청 페이지 주소. 신고함에서 글자로만 보여 준다
  message      text check (char_length(message) <= 1000),
  contact      text check (char_length(contact) <= 100),       -- 답장 받을 연락처(이메일·전화·인스타 아이디)
  status       text not null default 'open' check (status in ('open', 'done')),
  resolved_at  timestamptz,
  ip_hash      text,
  visitor_id   text,
  created_at   timestamptz not null default now()
);
create index if not exists inquiries_open_idx on inquiries (created_at desc) where status = 'open';
create index if not exists inquiries_ip_idx on inquiries (ip_hash, created_at);
alter table inquiries enable row level security;

revoke all on inquiries from anon, authenticated;


-- ═══════════ 0017_book_covers.sql ═══════════
-- 책 표지 사진을 운영자가 직접 올린다(책 API 연결 전 · 연결 후에도 직접 올린 사진이 먼저 보인다).
-- 책마다 한 번만 올린다: 모임의 책 제목(book_title_text)에서 띄어쓰기·『』 같은 괄호·대소문자를 뺀 값(title_key)이 같으면 같은 책으로 본다.
-- 관리자 화면 /admin/covers 에서 올리고 바꾸고 뺀다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0016 다음에 실행)

create table if not exists book_covers (
  title_key   text primary key,                 -- 앱 파일 src/lib/book-covers.ts 의 titleKey() 로 만든 값
  title       text not null,                    -- 처음 올릴 때의 책 제목(보기용)
  image_path  text not null,                    -- 보관함(book-covers) 안의 파일 이름
  updated_at  timestamptz not null default now()
);
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
alter table book_covers enable row level security;

-- 사진 보관함. 누구나 사진 주소로 볼 수 있지만(공개), 올리기·지우기는 서버만 한다.
-- 사진은 올리기 전에 화면에서 가로 480px JPG 로 줄여서 보내므로 1MB 이하로 제한한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ═══════════ 0018_meeting_time_note.sql ═══════════
-- 모임 '시간 안내' 칸 추가: 같은 신청서로 받는데 시간만 다른 반(예: 8세·7세, 1부·2부)을 한 모임으로 올릴 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0017 다음에 실행)
-- 쓰는 법: time_note 에 '(8세) 오후 3:50 / (7세) 오후 5:00'처럼 적는다(반 이름은 괄호 안, 반 사이는 ' / '). 60자까지.
--   적으면 목록 카드·모임 화면·내 모임에서 시간 자리에 이 글자가 대신 보인다. 비워 두면 지금처럼 시간 하나만 보인다.
--   starts_at 에는 '늦은 반' 시각을 넣는다(그 시각이 지나야 '지난 모임'이 되고, 날짜순 정렬도 이 값으로 한다).
alter table meetings add column if not exists time_note text;
alter table meetings drop constraint if exists meetings_time_note_length;
alter table meetings add constraint meetings_time_note_length check (char_length(time_note) <= 60);


-- ═══════════ 0019_meeting_series.sql ═══════════
-- 모임 '묶음 이름' 칸 추가: 여러 회차를 한 번에(일괄) 신청하는 모임을 한 묶음으로 보여 줄 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0018 다음에 실행)
-- 쓰는 법: 같은 묶음의 회차들에 같은 series_key 를 적는다(예: 'doi-lazybird-2026'). 40자까지, 책방 이름+모임 이름+연도처럼 겹치지 않게.
--   적으면 첫 화면·책방 화면 목록에는 아직 안 지난 첫 회차에만 카드가 한 장 나오고,
--   모임 화면에는 '회차 일정'이 보이며, '내 모임에 담기'를 누르면 남은 회차가 모두 담긴다.
--   비워 두면 지금처럼 회차마다 카드가 따로 나온다(한 회씩 신청하는 모임은 비워 둔다).
alter table meetings add column if not exists series_key text;
alter table meetings drop constraint if exists meetings_series_key_length;
alter table meetings add constraint meetings_series_key_length check (char_length(series_key) <= 40);
create index if not exists meetings_series_key_idx on meetings (series_key) where series_key is not null;


-- ═══════════ 0020_meeting_apply_method.sql ═══════════
-- 모임 '신청 방식' 칸 추가: 신청 버튼 글자를 신청 방식에 맞게 바꿔 보여 줄 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0019 다음에 실행)
-- 값:
--   'form' (기본) 신청서·예약 페이지로 신청 → '책방에서 신청하기 ↗'
--   'dm'          인스타 DM으로 신청 → '인스타 DM으로 신청하기 ↗' (apply_url 에 책방 인스타 계정 주소)
--   'none'        신청 없이 자유 방문 → 버튼 대신 '신청 없이 자유롭게 오시면 돼요' (apply_url 에는 게시물 주소를 넣어 둔다)
alter table meetings add column if not exists apply_method text not null default 'form';
alter table meetings drop constraint if exists meetings_apply_method_check;
alter table meetings add constraint meetings_apply_method_check check (apply_method in ('form', 'dm', 'none'));


-- ═══════════ 0021_meeting_ends_at.sql ═══════════
-- 모임 '끝나는 시각' 칸 추가: 목록 카드·모임 화면·내 모임에 '오후 6:30 ~ 9:00'처럼 시작~끝을 함께 보여 준다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0020 다음에 실행)
-- 쓰는 법: ends_at 에 '2026-10-10 21:00+09' 형식으로 넣는다. 비워 두면 지금처럼 시작 시각만 보인다.
--   '지난 모임' 판단과 날짜순 정렬은 지금처럼 starts_at 으로 한다(시작한 뒤에는 신청할 수 없어서).
--   시간 안내(time_note, 0018)를 적은 모임은 그 글자가 먼저 보인다.
alter table meetings add column if not exists ends_at timestamptz;

-- 끝나는 시각이 시작 시각보다 빠르면 저장을 막는다(오타 방지)
alter table meetings drop constraint if exists meetings_ends_after_starts;
alter table meetings add constraint meetings_ends_after_starts check (ends_at is null or ends_at > starts_at);


-- ═══════════ 0022_formats_v3.sql ═══════════
-- 모임방식 목록에 '원서읽기'·'책놀이' 추가
-- (영어원서 모임과 그림책 놀이 모임이 함께읽기·기타에 섞여 있어서 따로 찾을 수 있게)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 목록은 첫 화면 드롭박스(src/lib/tags.ts)와 똑같이 맞춘다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

-- 새 이름 넣고, 순서를 새 목록대로 맞추기
insert into formats (name, sort_order)
select name, ord from unnest(array['토론', '함께읽기', '원서읽기', '낭독', '필사', '글쓰기', '북토크', '책놀이', '기타']) with ordinality as t(name, ord)
on conflict (name) do update set sort_order = excluded.sort_order;


-- ═══════════ 0023_review_queue.sql ═══════════
-- 승인 대기: Claude가 정리한 모임·책방을 '숨긴 채로' 먼저 넣고, 운영자 화면(/admin/review)에서 [승인]을 누르면 공개한다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0022 다음에 실행)
--
-- 넣는 법(대기 모임):  is_hidden = true,  pending_review = true,  review_note = '확인할 점'(선택)
-- 넣는 법(대기 책방):  is_blocked = true, pending_review = true,  review_note = '확인할 점'(선택)
--   숨김·차단 칸을 함께 켜 두므로, 이 설정문이나 화면 코드가 배포되기 전에도 손님에게는 절대 보이지 않는다.
-- 승인:    모임 is_hidden = false / 책방 is_blocked = false, pending_review = false
-- 넣지 않음: pending_review = false 만 바꾸고 숨김은 그대로 둔다(지우지 않는다)
alter table meetings add column if not exists pending_review boolean not null default false;
alter table meetings add column if not exists review_note text;
alter table stores add column if not exists pending_review boolean not null default false;
alter table stores add column if not exists review_note text;

create index if not exists meetings_pending_review_idx on meetings (store_id, starts_at) where pending_review;

-- 운영자 기록에 '승인'·'넣지 않음'을 남길 수 있게 한다
alter table admin_actions drop constraint if exists admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check check (action in ('close', 'hide', 'edit', 'ok', 'approve', 'reject'));


-- ═══════════ 0024_exhibitions.sql ═══════════
-- 책방 전시 소식: 책방 안에서 여는 그림·사진 전시, 그림책 원화전, 팝업·굿즈 행사.
-- 독자가 전시를 보러 책방에 직접 가 보게 하는 게 목적이라, 작품 사진은 싣지 않고 포스터 한 장만 쓴다(작품은 책방에 가서 본다).
-- 모임과 같은 흐름: Claude가 모임 정리할 때 함께 '숨긴 채로' 넣고 → 운영자 화면(/admin/review)에서 승인하면 공개.
-- 포스터는 책방 허가를 받은 뒤에만 공개한다(승인 버튼이 한 번 더 묻는다).
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0023 다음에 실행)
--
-- 넣는 법(대기 전시):  is_hidden = true, pending_review = true, review_note = '확인할 점'(선택)
-- 승인:    is_hidden = false, pending_review = false
-- 넣지 않음: pending_review = false 만 바꾸고 숨김은 그대로 둔다(지우지 않는다)

create table if not exists exhibitions (
  id              bigint generated always as identity primary key,
  store_id        bigint not null references stores(id) on delete cascade,
  title           text not null check (char_length(title) <= 120),
  kind            text not null check (kind in ('전시', '원화전', '팝업')), -- 그림·사진 전시 / 그림책 원화전 / 팝업·굿즈 행사
  artist          text check (char_length(artist) <= 120),                 -- 작가 이름(여럿이면 쉼표로)
  starts_on       date not null,                                           -- 첫날(한국 날짜)
  ends_on         date not null,                                           -- 마지막 날(이날까지 볼 수 있음)
  hours_note      text check (char_length(hours_note) <= 200),             -- 전시 시간이 책방 운영시간과 다를 때만
  is_paid         boolean not null default false,                          -- 대부분 무료라 유료일 때만 표시한다
  fee_note        text check (char_length(fee_note) <= 60),                -- 유료일 때 금액('5,000원'). 모르면 비워 둔다
  intro           text check (char_length(intro) <= 2000),                 -- 짧은 소개(책방 게시물을 옮겨 적음)
  post_url        text,                                                    -- 책방 인스타 게시물 원문
  poster_path     text,                                                    -- 보관함(exhibition-posters) 안의 파일 이름
  poster_width    int,                                                     -- 포스터 원래 비율로 자리를 잡아 두려고(화면이 덜컹이지 않게)
  poster_height   int,
  is_hidden       boolean not null default true,
  pending_review  boolean not null default false,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists exhibitions_store_idx on exhibitions (store_id, ends_on);
create index if not exists exhibitions_pending_review_idx on exhibitions (starts_on) where pending_review;

-- 전시 찜: 회원 탈퇴(users 삭제) 시 함께 지워진다
create table if not exists exhibition_wishes (
  user_id        uuid not null references users(id) on delete cascade,
  exhibition_id  bigint not null references exhibitions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, exhibition_id)
);
create index if not exists exhibition_wishes_exhibition_idx on exhibition_wishes (exhibition_id, created_at);

-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
alter table exhibitions enable row level security;
alter table exhibition_wishes enable row level security;

-- 포스터 보관함. 누구나 사진 주소로 볼 수 있지만(공개), 올리기·지우기는 서버만 한다.
-- 올리기 전에 화면에서 긴 쪽 1600px JPG 로 줄여서 보내므로 2MB 이하로 제한한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exhibition-posters', 'exhibition-posters', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ═══════════ 0025_push.sql ═══════════
-- 앱 알림(PWA 푸시): 찜한 모임(3일 전·당일 아침), 찜한 책방의 새 모임, 찜한 전시가 끝나기 3일 전
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0024 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 서버만 읽고 쓴다. 회원 탈퇴 시 함께 지워진다.

-- ─────────────────────────────────────────────
-- 1) 알림 받을 기기. 한 사람이 휴대폰·컴퓨터 등 여러 기기를 둘 수 있다.
--    endpoint: 휴대폰 회사(구글·애플 등)가 정해 주는 '이 기기로 보내는 주소'
-- ─────────────────────────────────────────────
create table if not exists push_subscriptions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  platform     text not null default 'other' check (platform in ('ios', 'android', 'desktop', 'other')),
  installed    boolean not null default false, -- 홈 화면에 설치한 앱에서 켰는지
  is_internal  boolean not null default false, -- 운영자 기기(통계에서 뺀다)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- ─────────────────────────────────────────────
-- 2) 알림 종류별 켜고 끄기(사람 단위, 기기와 상관없이). 줄이 없으면 모두 켠 것으로 본다
-- ─────────────────────────────────────────────
create table if not exists push_prefs (
  user_id     uuid primary key references users(id) on delete cascade,
  meeting     boolean not null default true, -- 찜한 모임 3일 전·당일 아침
  store_new   boolean not null default true, -- 찜한 책방의 새 모임
  exhibition  boolean not null default true, -- 찜한 전시 끝나기 3일 전
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 3) 보낸 알림(아침에 모아 보낸 한 통 = 한 줄). 열어 본 시각으로 '열어 본 비율'을 센다
--    kinds: 담긴 알림 종류(meeting_3d, meeting_today, store_new, exhibition_end, test)
-- ─────────────────────────────────────────────
create table if not exists push_sends (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  kinds        text[] not null,
  item_count   int not null default 1,
  devices      int not null default 0, -- 실제로 전달된 기기 수(0이면 못 보냄)
  is_internal  boolean not null default false,
  sent_at      timestamptz not null default now(),
  opened_at    timestamptz
);
create index if not exists push_sends_sent_idx on push_sends (sent_at);

-- 같은 알림을 두 번 보내지 않기 위한 기록. item_key 예: m3:123(모임 3일 전), m0:123(당일), s:456(새 모임), e3:789(전시)
create table if not exists push_sent_items (
  user_id   uuid not null references users(id) on delete cascade,
  item_key  text not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table push_subscriptions enable row level security;
alter table push_prefs         enable row level security;
alter table push_sends         enable row level security;
alter table push_sent_items    enable row level security;

-- ─────────────────────────────────────────────
-- 4) 모임이 손님에게 처음 보이기 시작한 시각(찜한 책방의 '새 모임' 알림용)
--    숨김(is_hidden)이 풀리는 순간 자동으로 적힌다. 이미 공개된 모임은 올린 날로 채워서 '새 모임'으로 보내지 않는다
-- ─────────────────────────────────────────────
alter table meetings add column if not exists published_at timestamptz;
update meetings set published_at = created_at where published_at is null and not is_hidden;

create or replace function set_meeting_published_at() returns trigger
language plpgsql as $$
begin
  if not new.is_hidden and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists meetings_published_at on meetings;
create trigger meetings_published_at before insert or update of is_hidden on meetings
  for each row execute function set_meeting_published_at();

create index if not exists meetings_published_idx on meetings (store_id, published_at);


-- ═══════════ 0026_card_click.sql ═══════════
-- 어드민 '통계'용 새 기록 4가지(봇·운영자 기기 제외는 기존 events 방식 그대로)
--   card_click     목록에서 모임 카드를 눌러 상세 화면으로 감(모임별·책방별)
--   store_view     책방 상세 화면이 열림(props.from: 어디서 왔는지)
--   store_contact  책방 지도·전화·인스타 링크 클릭(props.kind: map|tel|instagram, props.page: store|meeting|exhibition)
--   search_empty   홈에서 검색·필터·날짜를 바꾼 결과가 0건(props: q·지역·장르·모임방식·날짜. 검색어는 이메일·전화번호 모양을 가림)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0025 다음에 실행. 배포 전에 실행하면 첫날부터 쌓인다)
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan',
                  'card_click', 'store_view', 'store_contact', 'search_empty'));


-- ═══════════ 0027_human_sessions.sql ═══════════
-- 사람 확인 방문 + 유입 채널에 '들어온 곳' 반영 (2026-10-27)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0026 다음에 실행. 여러 번 실행해도 괜찮다)
--
-- 1) page_seen: 화면이 브라우저에서 실제로 그려지면 브라우저가 보내는 신호(ClickTracker).
--    브라우저인 척하고 링크만 두드리는 프로그램은 화면을 그리지 않아 이 신호가 없다.
-- 2) v_events_clean: 첫 page_seen 이 들어온 뒤부터는 page_seen 이 있는 세션의 기록만 센다.
--    그 전 기록(사람 확인 기능 배포 전)은 예전처럼 봇·운영자 표시만으로 거른다 → 지난 숫자가 사라지지 않는다.
--    이 뷰를 쓰는 모든 지표(월 순방문자, 재방문율, 검색·필터 비율, 책방 리포트, 신청 클릭 등)에 함께 적용된다.
-- 3) v_channel_mix: UTM 이 없으면 들어온 곳(referrer)으로 search·instagram·facebook·kakao·other 를 나눈다.

alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan',
                  'card_click', 'store_view', 'store_contact', 'search_empty', 'page_seen'));

create index if not exists events_page_seen_session_idx on events (session_id) where type = 'page_seen';

-- 칸은 처음 만들 때(0001) 순서 그대로 적는다. events 에 나중에 생긴 user_id 를 e.* 로 끼우면 칸 순서가 바뀌어 실패한다
create or replace view v_events_clean as
select e.id, e.created_at, e.visitor_id, e.session_id, e.type, e.meeting_id, e.store_id, e.path, e.props,
       e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.referrer, e.user_agent, e.is_bot, e.is_internal,
       to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       (e.created_at at time zone 'Asia/Seoul')::date            as day_kst
from events e
where not e.is_bot and not e.is_internal
  and (
    not exists (select 1 from events s where s.type = 'page_seen')
    or e.created_at < (select min(s.created_at) from events s where s.type = 'page_seen')
    or exists (select 1 from events h where h.type = 'page_seen' and h.session_id = e.session_id)
  );

create or replace view v_channel_mix as
with per_visitor as (
  select distinct on (month_kst, visitor_id) month_kst, visitor_id,
         case
           when utm_source is not null and utm_source <> 'direct' then utm_source
           when referrer is null or referrer = '' then 'direct'
           when referrer ~* '^https?://([^/]*\.)?owlbookclub\.(com|vercel\.app)' then 'direct'
           when referrer ~* '^https?://([^/]*\.)?(google|naver|daum|bing|yahoo|zum)\.' then 'search'
           when referrer ~* '^https?://([^/]*\.)?instagram\.com' then 'instagram'
           when referrer ~* '^https?://([^/]*\.)?(facebook\.com|fb\.me)' then 'facebook'
           when referrer ~* '^https?://([^/]*\.)?(kakao\.com|kakaocdn\.net)' then 'kakao'
           else 'other'
         end as channel
  from v_events_clean order by month_kst, visitor_id, created_at
)
select month_kst, channel, count(*) as visitors,
       round(100.0 * count(*) / sum(count(*)) over (partition by month_kst), 1) as share_pct
from per_visitor group by 1, 2 order by 1, 3 desc;


-- ═══════════ 0028_human_cutoff_fix.sql ═══════════
-- 0027 고침: 사람 확인 기준이 켜지는 시점을 '실제 방문자(운영자·봇 아님)의 첫 page_seen' 으로 바꾼다.
-- 0027 은 운영자 기기의 시험 신호로도 기준이 켜져서, 배포 전(실제 사이트가 아직 신호를 안 보낼 때) 들어온 방문이 숫자에서 빠질 수 있었다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0027 다음에 실행. 여러 번 실행해도 괜찮다)
create or replace view v_events_clean as
select e.id, e.created_at, e.visitor_id, e.session_id, e.type, e.meeting_id, e.store_id, e.path, e.props,
       e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.referrer, e.user_agent, e.is_bot, e.is_internal,
       to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       (e.created_at at time zone 'Asia/Seoul')::date            as day_kst
from events e
where not e.is_bot and not e.is_internal
  and (
    not exists (select 1 from events s where s.type = 'page_seen' and not s.is_bot and not s.is_internal)
    or e.created_at < (select min(s.created_at) from events s where s.type = 'page_seen' and not s.is_bot and not s.is_internal)
    or exists (select 1 from events h where h.type = 'page_seen' and h.session_id = e.session_id)
  );


-- ═══════════ 0029_meeting_cover_art.sql ═══════════
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


-- ═══════════ 0030_data_guards.sql ═══════════
-- DB 안전장치 3가지 (2026-10-30). 앱 화면·코드는 바꾸지 않는다 → 배포 없이 이 파일만 실행하면 된다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0029 다음에 실행)
--
-- 1) 빈 글자 막기: '비어 있으면 안 됨'(not null)은 빈 글자('')나 띄어쓰기만 있는 값은 못 막는다.
--    모임 제목·책방 이름·전시 제목에 글자가 하나도 없으면 저장을 막는다.
--    모임 신청 링크는 승인 대기 중에는 비워 둘 수 있게 두고(승인 화면에서 나중에 채운다), 손님에게 보이는 모임만 막는다.
-- 2) 승인 전 공개 막기: 승인 대기(pending_review)인 모임·전시는 반드시 숨김, 책방은 반드시 차단 상태여야 한다.
--    확인 안 된 정보가 실수로 손님에게 보이는 일을 DB가 막는다.
-- 3) 전시 지우기 막기: 모임처럼 전시도 지우지 않고 숨긴다(is_hidden).
--    책방을 지우면 전시가, 전시를 지우면 회원의 전시 찜이 함께 사라지던 것을 '지우기 막기'로 바꾼다.
--    회원 탈퇴 때 그 회원의 전시 찜이 함께 지워지는 것은 그대로다.
--
-- 규칙에 어긋나는 값이 이미 있으면 여기서 멈추고 어느 것인지 알려 준다. 표 편집기에서 고친 뒤 다시 Run 하면 된다.
-- (2026-10-30 실제 DB 확인: 어긋나는 값 없음)

do $$
declare
  bad text;
begin
  select string_agg(line, E'\n')
    into bad
  from (
    select format('[모임 번호 %s] 제목이 비어 있음', id) as line from meetings where title !~ '\S'
    union all
    select format('[모임 번호 %s] %s → 공개된 모임인데 신청 링크가 비어 있음', id, title) from meetings where not is_hidden and apply_url !~ '\S'
    union all
    select format('[모임 번호 %s] %s → 승인 대기인데 숨김이 꺼져 있음', id, title) from meetings where pending_review and not is_hidden
    union all
    select format('[책방 번호 %s] 이름이 비어 있음', id) from stores where name !~ '\S'
    union all
    select format('[책방 번호 %s] %s → 승인 대기인데 차단이 꺼져 있음', id, name) from stores where pending_review and not is_blocked
    union all
    select format('[전시 번호 %s] 제목이 비어 있음', id) from exhibitions where title !~ '\S'
    union all
    select format('[전시 번호 %s] %s → 승인 대기인데 숨김이 꺼져 있음', id, title) from exhibitions where pending_review and not is_hidden
  ) t;

  if bad is not null then
    raise exception E'새 규칙에 어긋나는 값이 있어요. 아래를 고친 뒤 다시 실행해 주세요.\n%', bad;
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 빈 글자 막기 ('\S' = 띄어쓰기·줄바꿈이 아닌 글자가 하나라도 있음)
-- ─────────────────────────────────────────────
alter table meetings drop constraint if exists meetings_title_not_blank;
alter table meetings add constraint meetings_title_not_blank check (title ~ '\S');

alter table meetings drop constraint if exists meetings_apply_url_when_public;
alter table meetings add constraint meetings_apply_url_when_public check (is_hidden or apply_url ~ '\S');

alter table stores drop constraint if exists stores_name_not_blank;
alter table stores add constraint stores_name_not_blank check (name ~ '\S');

alter table exhibitions drop constraint if exists exhibitions_title_not_blank;
alter table exhibitions add constraint exhibitions_title_not_blank check (title ~ '\S');

-- ─────────────────────────────────────────────
-- 2) 승인 전 공개 막기
-- ─────────────────────────────────────────────
alter table meetings drop constraint if exists meetings_pending_is_hidden;
alter table meetings add constraint meetings_pending_is_hidden check (not pending_review or is_hidden);

alter table stores drop constraint if exists stores_pending_is_blocked;
alter table stores add constraint stores_pending_is_blocked check (not pending_review or is_blocked);

alter table exhibitions drop constraint if exists exhibitions_pending_is_hidden;
alter table exhibitions add constraint exhibitions_pending_is_hidden check (not pending_review or is_hidden);

-- ─────────────────────────────────────────────
-- 3) 전시 지우기 막기 (cascade → restrict)
-- ─────────────────────────────────────────────
alter table exhibitions drop constraint if exists exhibitions_store_id_fkey;
alter table exhibitions add constraint exhibitions_store_id_fkey
  foreign key (store_id) references stores(id) on delete restrict;

alter table exhibition_wishes drop constraint if exists exhibition_wishes_exhibition_id_fkey;
alter table exhibition_wishes add constraint exhibition_wishes_exhibition_id_fkey
  foreign key (exhibition_id) references exhibitions(id) on delete restrict;


-- ═══════════ 0031_applied_migrations_updated_at.sql ═══════════
-- DB 출석부 + '마지막으로 고친 시각' 자동 기록 (2026-10-30). 앱 화면·코드는 바꾸지 않는다 → 배포 없이 이 파일만 실행하면 된다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0030 다음에 실행)
--
-- 1) 출석부(applied_migrations): 어떤 변경 파일까지 이 DB에 실행했는지 DB가 기억한다.
--    Table Editor > applied_migrations 에서 본다. 맨 아래 줄이 마지막으로 실행한 파일이다.
--    0001~0030 은 실행한 날을 정확히 몰라서 날짜 칸(applied_at)을 비워 둔다.
--    앞으로 변경 파일은 맨 끝에 아래 모양의 '출석 체크'를 넣는다. Run 이 끝까지 성공해야 한 줄이 적힌다.
--      insert into applied_migrations (version, name) values ('0032', '이름') on conflict (version) do nothing;
-- 2) updated_at: 모임·책방을 고칠 때마다 DB가 그 시각을 자동으로 적는다(앱 코드가 적지 않아도 된다).
--    지금 있는 모임·책방은 처음 올린 시각(created_at)으로 채운다.

-- ─────────────────────────────────────────────
-- 1) 출석부
-- ─────────────────────────────────────────────
create table if not exists applied_migrations (
  version     text primary key,                     -- 파일 앞 번호. 예: '0031'
  name        text not null,                        -- 파일 이름의 나머지. 예: 'applied_migrations_updated_at'
  applied_at  timestamptz default now()             -- 실행한 시각. 0001~0030 은 비어 있음
);
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 손님(브라우저)에게는 보이지 않는다.
alter table applied_migrations enable row level security;
revoke all on applied_migrations from anon, authenticated;

insert into applied_migrations (version, name, applied_at)
select v, n, null
from (values
  ('0001', 'init'), ('0002', 'auth'), ('0003', 'mypage'), ('0004', 'book_author'), ('0005', 'regions'),
  ('0006', 'tags'), ('0007', 'store_address'), ('0008', 'meeting_description'), ('0009', 'meeting_plans'),
  ('0010', 'meeting_hidden'), ('0011', 'reports'), ('0012', 'store_intro'), ('0013', 'formats_v2'),
  ('0014', 'genres_picturebook'), ('0015', 'store_hours_phone'), ('0016', 'inquiries'), ('0017', 'book_covers'),
  ('0018', 'meeting_time_note'), ('0019', 'meeting_series'), ('0020', 'meeting_apply_method'),
  ('0021', 'meeting_ends_at'), ('0022', 'formats_v3'), ('0023', 'review_queue'), ('0024', 'exhibitions'),
  ('0025', 'push'), ('0026', 'card_click'), ('0027', 'human_sessions'), ('0028', 'human_cutoff_fix'),
  ('0029', 'meeting_cover_art'), ('0030', 'data_guards')
) as t(v, n)
on conflict (version) do nothing;

-- ─────────────────────────────────────────────
-- 2) 마지막으로 고친 시각
-- ─────────────────────────────────────────────
alter table meetings add column if not exists updated_at timestamptz;
alter table stores   add column if not exists updated_at timestamptz;

-- 지금 있는 행은 처음 올린 시각으로 채운다(아래 자동 기록 장치를 켜기 전에 해야 오늘 날짜로 덮이지 않는다)
update meetings set updated_at = created_at where updated_at is null;
update stores   set updated_at = created_at where updated_at is null;

alter table meetings alter column updated_at set default now();
alter table meetings alter column updated_at set not null;
alter table stores   alter column updated_at set default now();
alter table stores   alter column updated_at set not null;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists meetings_updated_at on meetings;
create trigger meetings_updated_at before update on meetings
  for each row execute function set_updated_at();

drop trigger if exists stores_updated_at on stores;
create trigger stores_updated_at before update on stores
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0031 출석 완료'와 실행 시각이 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0031', 'applied_migrations_updated_at') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0031';
