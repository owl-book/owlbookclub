-- 사람 확인 방문 + 유입 채널에 '들어온 곳' 반영 (2026-10-27)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0026 다음에 실행. 여러 번 실행해도 괜찮다)
--
-- 1) page_seen: 화면이 브라우저에서 실제로 그려지면 브라우저가 보내는 신호(ClickTracker).
--    브라우저인 척하고 링크만 두드리는 프로그램은 화면을 그리지 않아 이 신호가 없다.
-- 2) v_events_clean: 첫 page_seen 이 들어온 뒤부터는 page_seen 이 있는 세션의 기록만 센다.
--    그 전 기록(사람 확인 기능 배포 전)은 예전처럼 봇·운영자 표시만으로 거른다 → 지난 숫자가 사라지지 않는다.
--    이 뷰를 쓰는 모든 지표(월 순방문자, 재방문율, 검색·필터 비율, 책방 리포트, 신청 클릭 등)에 함께 적용된다.
-- 3) v_channel_mix: UTM 이 없으면 들어온 곳(referrer)으로 search·instagram·facebook·kakao·other 를 나눈다.

alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan',
                  'card_click', 'store_view', 'store_contact', 'search_empty', 'page_seen'));

create index if not exists events_page_seen_session_idx on events (session_id) where type = 'page_seen';

-- 칸은 처음 만들 때(0001) 순서 그대로 적는다. events 에 나중에 생긴 user_id 를 e.* 로 끼우면 칸 순서가 바뀌어 실패한다
create or replace view v_events_clean as
select e.id, e.created_at, e.visitor_id, e.session_id, e.type, e.meeting_id, e.store_id, e.path, e.props,
       e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.referrer, e.user_agent, e.is_bot, e.is_internal,
       to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       (e.created_at at time zone 'Asia/Seoul')::date            as day_kst
from events e
where not e.is_bot and not e.is_internal
  and (
    not exists (select 1 from events s where s.type = 'page_seen')
    or e.created_at < (select min(s.created_at) from events s where s.type = 'page_seen')
    or exists (select 1 from events h where h.type = 'page_seen' and h.session_id = e.session_id)
  );

create or replace view v_channel_mix as
with per_visitor as (
  select distinct on (month_kst, visitor_id) month_kst, visitor_id,
         case
           when utm_source is not null and utm_source <> 'direct' then utm_source
           when referrer is null or referrer = '' then 'direct'
           when referrer ~* '^https?://([^/]*\.)?owlbookclub\.(com|vercel\.app)' then 'direct'
           when referrer ~* '^https?://([^/]*\.)?(google|naver|daum|bing|yahoo|zum)\.' then 'search'
           when referrer ~* '^https?://([^/]*\.)?instagram\.com' then 'instagram'
           when referrer ~* '^https?://([^/]*\.)?(facebook\.com|fb\.me)' then 'facebook'
           when referrer ~* '^https?://([^/]*\.)?(kakao\.com|kakaocdn\.net)' then 'kakao'
           else 'other'
         end as channel
  from v_events_clean order by month_kst, visitor_id, created_at
)
select month_kst, channel, count(*) as visitors,
       round(100.0 * count(*) / sum(count(*)) over (partition by month_kst), 1) as share_pct
from per_visitor group by 1, 2 order by 1, 3 desc;
