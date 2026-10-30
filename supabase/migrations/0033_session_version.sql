-- 다른 기기 모두 로그아웃(출입증 버전)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0032 다음에 실행)
-- 로그인 쿠키에 이 숫자를 함께 넣어 두고, 저장·마이페이지·앱 로그인 늘리기 때 대조한다.
-- '다른 기기 모두 로그아웃'을 누르면 숫자를 1 올린다 → 예전 숫자를 가진 다른 기기의 로그인은 더 이상 통하지 않는다.
-- 기존 회원은 모두 1에서 시작한다(숫자가 없는 예전 쿠키도 1로 본다 → 이 파일을 실행해도 아무도 로그아웃되지 않는다).

alter table users add column if not exists session_version integer not null default 1;

alter table users drop constraint if exists users_session_version_check;
alter table users add constraint users_session_version_check check (session_version >= 1);

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0033 출석 완료'가 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0033', 'session_version') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0033';
