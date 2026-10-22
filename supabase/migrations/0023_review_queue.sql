-- 승인 대기: Claude가 정리한 모임·책방을 '숨긴 채로' 먼저 넣고, 운영자 화면(/admin/review)에서 [승인]을 누르면 공개한다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0022 다음에 실행)
--
-- 넣는 법(대기 모임):  is_hidden = true,  pending_review = true,  review_note = '확인할 점'(선택)
-- 넣는 법(대기 책방):  is_blocked = true, pending_review = true,  review_note = '확인할 점'(선택)
--   숨김·차단 칸을 함께 켜 두므로, 이 설정문이나 화면 코드가 배포되기 전에도 손님에게는 절대 보이지 않는다.
-- 승인:    모임 is_hidden = false / 책방 is_blocked = false, pending_review = false
-- 넣지 않음: pending_review = false 만 바꾸고 숨김은 그대로 둔다(지우지 않는다)
alter table meetings add column if not exists pending_review boolean not null default false;
alter table meetings add column if not exists review_note text;
alter table stores add column if not exists pending_review boolean not null default false;
alter table stores add column if not exists review_note text;

create index if not exists meetings_pending_review_idx on meetings (store_id, starts_at) where pending_review;

-- 운영자 기록에 '승인'·'넣지 않음'을 남길 수 있게 한다
alter table admin_actions drop constraint if exists admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check check (action in ('close', 'hide', 'edit', 'ok', 'approve', 'reject'));
