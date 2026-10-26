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
