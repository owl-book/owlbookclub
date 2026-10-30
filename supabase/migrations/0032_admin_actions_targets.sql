-- 관리자 처리 기록(admin_actions)에 책방·전시·책 표지도 남기기 (2026-10-30)
-- 지금까지는 '모임 번호' 칸만 있어서 책방 승인·고치기, 전시 승인·포스터, 책 표지 올리기·빼기는 기록이 남지 않았다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0031 다음에 실행)
-- 순서: 시험용 DB에서 먼저 Run → 확인 → 실제 DB에서 Run → 그다음 배포(새 코드가 이 칸들에 기록을 쓴다).
--
-- target_type(대상 종류)에 따라 칸 하나만 채운다:
--   meeting    → meeting_id     (모임. 지금까지의 기록은 모두 이것)
--   store      → store_id       (책방)
--   exhibition → exhibition_id  (전시)
--   book_cover → cover_key      (책 표지. book_covers.title_key — 표지는 뺄 수 있어서 연결 규칙 없이 글자로 남긴다)
-- 대상 번호를 칸 하나로 합치지 않고 종류별로 나눈 이유: 모임·책방·전시 번호에 연결 규칙(FK)을 걸어 없는 번호가 기록되지 않게 하려고.
-- action 에 'upload'(사진 올리기·바꾸기), 'remove'(사진 빼기)를 더한다.

alter table admin_actions add column if not exists target_type text not null default 'meeting';
alter table admin_actions drop constraint if exists admin_actions_target_type_check;
alter table admin_actions add constraint admin_actions_target_type_check
  check (target_type in ('meeting', 'store', 'exhibition', 'book_cover'));

alter table admin_actions alter column meeting_id drop not null;
alter table admin_actions add column if not exists store_id bigint references stores(id) on delete restrict;
alter table admin_actions add column if not exists exhibition_id bigint references exhibitions(id) on delete restrict;
alter table admin_actions add column if not exists cover_key text;

-- 대상 종류와 채운 칸이 맞아야 저장된다(예: 종류는 '책방'인데 모임 번호가 들어가는 실수를 막는다)
alter table admin_actions drop constraint if exists admin_actions_one_target;
alter table admin_actions add constraint admin_actions_one_target check (
  (target_type = 'meeting'    and meeting_id is not null and store_id is null and exhibition_id is null and cover_key is null) or
  (target_type = 'store'      and store_id is not null and meeting_id is null and exhibition_id is null and cover_key is null) or
  (target_type = 'exhibition' and exhibition_id is not null and meeting_id is null and store_id is null and cover_key is null) or
  (target_type = 'book_cover' and cover_key is not null and meeting_id is null and store_id is null and exhibition_id is null)
);

alter table admin_actions drop constraint if exists admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('close', 'hide', 'edit', 'ok', 'approve', 'reject', 'upload', 'remove'));

create index if not exists admin_actions_store_idx on admin_actions (store_id, created_at desc) where store_id is not null;
create index if not exists admin_actions_exhibition_idx on admin_actions (exhibition_id, created_at desc) where exhibition_id is not null;
create index if not exists admin_actions_created_idx on admin_actions (created_at desc);

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0032 출석 완료'가 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0032', 'admin_actions_targets') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0032';
