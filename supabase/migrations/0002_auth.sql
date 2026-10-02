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
