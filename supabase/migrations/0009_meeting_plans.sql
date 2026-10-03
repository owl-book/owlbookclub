-- 내 모임: 찜 → 책방에서 신청했어요 → 다녀왔어요(또는 못 갔어요)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0008 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 서버만 읽고 쓴다.
--
-- 원칙(계획서 2장 '내 모임 원칙')
-- - 부엉이서재는 신청을 받지 않는다. 여기 남는 것은 '본인이 책방에서 신청했다고 표시한 사실'뿐이다.
-- - 개별 표시는 본인만 본다. 책방 리포트에는 합계만, '못 갔어요'는 리포트에 넣지 않는다.
-- - 모임 행은 지우지 않는다(게재 내림은 책방 is_blocked 로 숨김). 아래 외래키를 restrict 로 두어 실수로 지워도 막힌다.

create table if not exists meeting_plans (
  user_id     uuid not null references users(id) on delete cascade,
  meeting_id  bigint not null references meetings(id) on delete restrict,
  applied_at  timestamptz,                                       -- '책방에서 신청했어요'를 누른 시각(없으면 신청 표시 없이 다녀옴만 표시)
  owl_noted   boolean,                                           -- 신청서에 '부엉이'라고 적었다고 답함(선택. 모르면 비어 있음)
  attended    text check (attended in ('yes', 'no')),            -- 모임 뒤 확인: 다녀왔어요 / 못 갔어요. 확인 전엔 비어 있음
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, meeting_id)
);
create index if not exists meeting_plans_meeting_idx on meeting_plans (meeting_id) where applied_at is not null;

alter table meeting_plans enable row level security;

-- 기존 찜·기록도 모임이 지워질 때 함께 사라지지 않도록 restrict 로 바꾼다(사용자 기록 보호)
alter table meeting_wishes  drop constraint if exists meeting_wishes_meeting_id_fkey;
alter table meeting_wishes  add constraint meeting_wishes_meeting_id_fkey  foreign key (meeting_id) references meetings(id) on delete restrict;
alter table meeting_records drop constraint if exists meeting_records_meeting_id_fkey;
alter table meeting_records add constraint meeting_records_meeting_id_fkey foreign key (meeting_id) references meetings(id) on delete restrict;

-- 이벤트에 '내 모임'(props: action=apply|unapply|attend_yes|attend_no, owl_noted) 추가
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan'));

-- ═════════════════════════════════════════════
-- 지표 뷰
-- ═════════════════════════════════════════════

-- 책방 월간 리포트용 '신청 표시' 합계(월은 표시한 날 KST 기준. 지금 남아 있는 표시만 센다)
-- 누가 표시했는지, 다녀왔는지/못 갔는지는 넣지 않는다.
create or replace view v_store_apply_marks_monthly as
select to_char(p.applied_at at time zone 'Asia/Seoul', 'YYYY-MM') as month_kst,
       s.id as store_id, s.name as store_name, s.is_cooperative,
       count(*)                                  as apply_marks,       -- 부엉이 회원이 '책방에서 신청했어요'를 누른 수
       count(*) filter (where p.owl_noted)       as owl_noted_marks    -- 그중 '부엉이'라고 적었다고 답한 수
from meeting_plans p
join meetings m on m.id = p.meeting_id
join stores s on s.id = m.store_id
where p.applied_at is not null
group by 1, 2, 3, 4 order by 1, 3;

-- H2 점검용: 모임별 신청 클릭 vs 신청 표시(클릭은 세션 중복 제거값)
create or replace view v_apply_marks_vs_clicks as
select c.month_kst, c.store_id, c.store_name, c.is_cooperative, c.meeting_id, c.meeting_title,
       c.unique_clicks,
       (select count(*) from meeting_plans p where p.meeting_id = c.meeting_id and p.applied_at is not null) as apply_marks
from v_apply_clicks_by_meeting_store c;

revoke all on v_store_apply_marks_monthly, v_apply_marks_vs_clicks from anon, authenticated;
