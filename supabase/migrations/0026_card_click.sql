-- 모임 카드 클릭 기록: 홈·책방 화면 등 목록에서 모임 카드를 눌러 상세 화면으로 간 횟수(어드민 '통계'에서 모임별·책방별로 본다)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0025 다음에 실행. 배포 전에 실행하면 첫날부터 쌓인다)
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan', 'card_click'));
