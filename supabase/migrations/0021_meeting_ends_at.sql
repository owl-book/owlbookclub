-- 모임 '끝나는 시각' 칸 추가: 목록 카드·모임 화면·내 모임에 '오후 6:30 ~ 9:00'처럼 시작~끝을 함께 보여 준다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0020 다음에 실행)
-- 쓰는 법: ends_at 에 '2026-10-10 21:00+09' 형식으로 넣는다. 비워 두면 지금처럼 시작 시각만 보인다.
--   '지난 모임' 판단과 날짜순 정렬은 지금처럼 starts_at 으로 한다(시작한 뒤에는 신청할 수 없어서).
--   시간 안내(time_note, 0018)를 적은 모임은 그 글자가 먼저 보인다.
alter table meetings add column if not exists ends_at timestamptz;

-- 끝나는 시각이 시작 시각보다 빠르면 저장을 막는다(오타 방지)
alter table meetings drop constraint if exists meetings_ends_after_starts;
alter table meetings add constraint meetings_ends_after_starts check (ends_at is null or ends_at > starts_at);
