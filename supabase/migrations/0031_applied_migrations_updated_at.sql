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
