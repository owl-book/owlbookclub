-- 모임 '묶음 이름' 칸 추가: 여러 회차를 한 번에(일괄) 신청하는 모임을 한 묶음으로 보여 줄 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0018 다음에 실행)
-- 쓰는 법: 같은 묶음의 회차들에 같은 series_key 를 적는다(예: 'doi-lazybird-2026'). 40자까지, 책방 이름+모임 이름+연도처럼 겹치지 않게.
--   적으면 첫 화면·책방 화면 목록에는 아직 안 지난 첫 회차에만 카드가 한 장 나오고,
--   모임 화면에는 '회차 일정'이 보이며, '내 모임에 담기'를 누르면 남은 회차가 모두 담긴다.
--   비워 두면 지금처럼 회차마다 카드가 따로 나온다(한 회씩 신청하는 모임은 비워 둔다).
alter table meetings add column if not exists series_key text;
alter table meetings drop constraint if exists meetings_series_key_length;
alter table meetings add constraint meetings_series_key_length check (char_length(series_key) <= 40);
create index if not exists meetings_series_key_idx on meetings (series_key) where series_key is not null;
