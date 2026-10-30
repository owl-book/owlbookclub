-- 카카오 연결 끊기
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0033 다음에 실행)
-- 1) 회원이 카카오 설정에서 우리 서비스와의 연결을 끊으면: 바로 지우지 않고 로그아웃만 시키고 끊은 때를 적어 둔다.
--    다시 카카오로 로그인하면 비우고(찜·기록이 그대로 이어짐), 1년 동안 돌아오지 않으면 매일 정리가 회원 정보를 지운다.
-- 2) 회원 탈퇴 때 카카오 연결 끊기가 실패하면 카카오 회원번호만 잠깐 남겨 두고 매일 다시 시도한다(성공하거나 30번 실패하면 지움).

alter table users add column if not exists unlinked_at timestamptz;
create index if not exists users_unlinked_idx on users (unlinked_at) where unlinked_at is not null;

create table if not exists provider_unlinks (
  id                bigint generated always as identity primary key,
  provider          text not null check (provider in ('kakao')),
  provider_user_id  text not null,
  attempts          int not null default 0,
  last_error        text,
  created_at        timestamptz not null default now(),
  unique (provider, provider_user_id)
);

-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다
alter table provider_unlinks enable row level security;
revoke all on provider_unlinks from anon, authenticated;

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0034 출석 완료'가 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0034', 'provider_unlink') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0034';
