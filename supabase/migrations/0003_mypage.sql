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
