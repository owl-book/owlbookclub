-- 모임 '시간 안내' 칸 추가: 같은 신청서로 받는데 시간만 다른 반(예: 8세·7세, 1부·2부)을 한 모임으로 올릴 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0017 다음에 실행)
-- 쓰는 법: time_note 에 '(8세) 오후 3:50 / (7세) 오후 5:00'처럼 적는다(반 이름은 괄호 안, 반 사이는 ' / '). 60자까지.
--   적으면 목록 카드·모임 화면·내 모임에서 시간 자리에 이 글자가 대신 보인다. 비워 두면 지금처럼 시간 하나만 보인다.
--   starts_at 에는 '늦은 반' 시각을 넣는다(그 시각이 지나야 '지난 모임'이 되고, 날짜순 정렬도 이 값으로 한다).
alter table meetings add column if not exists time_note text;
alter table meetings drop constraint if exists meetings_time_note_length;
alter table meetings add constraint meetings_time_note_length check (char_length(time_note) <= 60);
