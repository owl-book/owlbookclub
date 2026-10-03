-- 모임 소개 칸 추가: 모임 상세화면 일시·장소 카드 아래 '모임 소개'에 보여 준다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 1000자까지. 비워 두면 화면에 나오지 않는다.
-- 쓰는 법(줄바꿈은 그대로 보인다):
--   빈 줄         → 문단 나누기
--   '- ' 또는 '* ' 로 시작 → 점 목록(•)  예: '- 음료 1잔 포함', '* 음료 1잔 포함'
--   '1. ' 로 시작          → 번호 목록(1. 2.)  예: '1. 자기소개'

alter table meetings add column if not exists description text;

alter table meetings drop constraint if exists meetings_description_length;
alter table meetings add constraint meetings_description_length check (char_length(description) <= 1000);

