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
  tag_format       text not null,                 -- 진행 방식: 발제, 낭독, 자유토론, 필사, 북토크 …
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
