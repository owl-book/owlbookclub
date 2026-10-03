-- 모임 하나만 숨기기 + '부엉이 기입' 질문 삭제
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0009 다음에 실행)

-- ─────────────────────────────────────────────
-- 1) 모임 숨김: 잘못 올렸거나 중복된 모임, 책방이 그 모임만 내려 달라고 한 경우
--    모임은 지우지 않고(사용자의 찜·내 모임·기록 보호) 이 칸을 true 로 바꾼다.
--    숨긴 모임은 목록·상세·검색·신청 링크에서 사라지고, 담아 둔 사용자에게만 글자로 남는다.
--    책방 전체를 내릴 때는 기존처럼 stores.is_blocked 를 쓴다.
-- ─────────────────────────────────────────────
alter table meetings add column if not exists is_hidden boolean not null default false;

-- 게이트 2: 월 게재 모임 수에서 숨긴 모임도 뺀다
create or replace view v_monthly_listed_meetings as
select to_char(m.starts_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       count(*) as meetings,
       count(*) filter (where s.is_cooperative) as cooperative_meetings
from meetings m join stores s on s.id = m.store_id
where not s.is_blocked and not m.is_hidden
group by 1 order by 1;

-- ─────────────────────────────────────────────
-- 2) '신청서에 부엉이라고 적었어요' 질문 삭제(기입을 강요하는 느낌을 주지 않도록)
--    칸을 지우기 전에 그 칸을 쓰는 리포트 뷰를 먼저 지우고 다시 만든다.
-- ─────────────────────────────────────────────
drop view if exists v_store_apply_marks_monthly;
alter table meeting_plans drop column if exists owl_noted;

create view v_store_apply_marks_monthly as
select to_char(p.applied_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       s.id as store_id, s.name as store_name, s.is_cooperative,
       count(*) as apply_marks   -- 부엉이 회원이 '책방에서 신청했어요'를 누른 수(누가 눌렀는지는 넣지 않음)
from meeting_plans p
join meetings m on m.id = p.meeting_id
join stores s on s.id = m.store_id
where p.applied_at is not null
group by 1, 2, 3, 4 order by 1, 3;

revoke all on v_monthly_listed_meetings, v_store_apply_marks_monthly from anon, authenticated;
