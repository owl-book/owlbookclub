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
