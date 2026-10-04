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
