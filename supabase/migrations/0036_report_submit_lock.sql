-- 신고 받기를 DB 안에서 한 번에 처리한다(세기 + 저장). 0035 다음에 실행.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 시험용 DB → 실제 DB 순서로, 실제 DB는 배포 전에 실행한다
-- (함수만 새로 생기므로 지금 사이트에는 영향 없음. 배포를 먼저 하면 신고가 안 보내지는 시간이 생긴다).
--
-- 왜: 예전에는 서버가 '몇 건인지 세기'와 '저장하기'를 따로 해서, 같은 순간에 여러 요청이 오면
--     모두 '아직 0건'으로 세고 모두 저장됐다.
-- 어떻게: 시작할 때 신고 창구 전체에 잠금을 걸어 요청을 한 줄로 세운다. 신고는 드물어서 기다림은 거의 없다.
--        잠금은 이 함수가 끝나면 저절로 풀린다.
--
-- 돌려주는 값
--   'ok'        : 저장함
--   'duplicate' : 같은 곳에서 1분 안에 같은 모임·같은 종류·같은 내용으로 이미 보냄 → 새로 저장하지 않음(화면엔 '보냈어요')
--   'too_many'  : 한도 넘음(10분 5건 / 하루 20건 / 같은 모임 하루 3건 / 사이트 전체 1시간 200건)

create or replace function submit_report(
  p_meeting_id bigint,
  p_kind       text,
  p_message    text,
  p_ip_hash    text,
  p_visitor_id text
) returns text
language plpgsql
set search_path = public
as $$
begin
  -- 신고 창구 잠금(한 번에 하나씩)
  perform pg_advisory_xact_lock(hashtext('owl:submit_report'));

  -- 같은 신고를 연달아 보냄(두 번 누르기 등)
  if exists (
    select 1 from reports
    where ip_hash = p_ip_hash
      and meeting_id = p_meeting_id
      and kind = p_kind
      and message is not distinct from p_message
      and created_at >= now() - interval '1 minute'
  ) then
    return 'duplicate';
  end if;

  -- 한도(서버 코드에 있던 값과 같음)
  if (select count(*) from reports where ip_hash = p_ip_hash and created_at >= now() - interval '10 minutes') >= 5
     or (select count(*) from reports where ip_hash = p_ip_hash and created_at >= now() - interval '1 day') >= 20
     or (select count(*) from reports where ip_hash = p_ip_hash and meeting_id = p_meeting_id and created_at >= now() - interval '1 day') >= 3
     or (select count(*) from reports where created_at >= now() - interval '1 hour') >= 200
  then
    return 'too_many';
  end if;

  insert into reports (meeting_id, kind, message, ip_hash, visitor_id)
  values (p_meeting_id, p_kind, p_message, p_ip_hash, p_visitor_id);
  return 'ok';
end $$;

-- 브라우저에서는 부를 수 없게, 서버만 부른다
revoke all on function submit_report(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function submit_report(bigint, text, text, text, text) to service_role;

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0036 출석 완료'가 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0036', 'report_submit_lock') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0036';
