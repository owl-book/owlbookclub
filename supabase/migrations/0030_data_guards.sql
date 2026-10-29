-- DB 안전장치 3가지 (2026-10-30). 앱 화면·코드는 바꾸지 않는다 → 배포 없이 이 파일만 실행하면 된다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0029 다음에 실행)
--
-- 1) 빈 글자 막기: '비어 있으면 안 됨'(not null)은 빈 글자('')나 띄어쓰기만 있는 값은 못 막는다.
--    모임 제목·책방 이름·전시 제목에 글자가 하나도 없으면 저장을 막는다.
--    모임 신청 링크는 승인 대기 중에는 비워 둘 수 있게 두고(승인 화면에서 나중에 채운다), 손님에게 보이는 모임만 막는다.
-- 2) 승인 전 공개 막기: 승인 대기(pending_review)인 모임·전시는 반드시 숨김, 책방은 반드시 차단 상태여야 한다.
--    확인 안 된 정보가 실수로 손님에게 보이는 일을 DB가 막는다.
-- 3) 전시 지우기 막기: 모임처럼 전시도 지우지 않고 숨긴다(is_hidden).
--    책방을 지우면 전시가, 전시를 지우면 회원의 전시 찜이 함께 사라지던 것을 '지우기 막기'로 바꾼다.
--    회원 탈퇴 때 그 회원의 전시 찜이 함께 지워지는 것은 그대로다.
--
-- 규칙에 어긋나는 값이 이미 있으면 여기서 멈추고 어느 것인지 알려 준다. 표 편집기에서 고친 뒤 다시 Run 하면 된다.
-- (2026-10-30 실제 DB 확인: 어긋나는 값 없음)

do $$
declare
  bad text;
begin
  select string_agg(line, E'\n')
    into bad
  from (
    select format('[모임 번호 %s] 제목이 비어 있음', id) as line from meetings where title !~ '\S'
    union all
    select format('[모임 번호 %s] %s → 공개된 모임인데 신청 링크가 비어 있음', id, title) from meetings where not is_hidden and apply_url !~ '\S'
    union all
    select format('[모임 번호 %s] %s → 승인 대기인데 숨김이 꺼져 있음', id, title) from meetings where pending_review and not is_hidden
    union all
    select format('[책방 번호 %s] 이름이 비어 있음', id) from stores where name !~ '\S'
    union all
    select format('[책방 번호 %s] %s → 승인 대기인데 차단이 꺼져 있음', id, name) from stores where pending_review and not is_blocked
    union all
    select format('[전시 번호 %s] 제목이 비어 있음', id) from exhibitions where title !~ '\S'
    union all
    select format('[전시 번호 %s] %s → 승인 대기인데 숨김이 꺼져 있음', id, title) from exhibitions where pending_review and not is_hidden
  ) t;

  if bad is not null then
    raise exception E'새 규칙에 어긋나는 값이 있어요. 아래를 고친 뒤 다시 실행해 주세요.\n%', bad;
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 빈 글자 막기 ('\S' = 띄어쓰기·줄바꿈이 아닌 글자가 하나라도 있음)
-- ─────────────────────────────────────────────
alter table meetings drop constraint if exists meetings_title_not_blank;
alter table meetings add constraint meetings_title_not_blank check (title ~ '\S');

alter table meetings drop constraint if exists meetings_apply_url_when_public;
alter table meetings add constraint meetings_apply_url_when_public check (is_hidden or apply_url ~ '\S');

alter table stores drop constraint if exists stores_name_not_blank;
alter table stores add constraint stores_name_not_blank check (name ~ '\S');

alter table exhibitions drop constraint if exists exhibitions_title_not_blank;
alter table exhibitions add constraint exhibitions_title_not_blank check (title ~ '\S');

-- ─────────────────────────────────────────────
-- 2) 승인 전 공개 막기
-- ─────────────────────────────────────────────
alter table meetings drop constraint if exists meetings_pending_is_hidden;
alter table meetings add constraint meetings_pending_is_hidden check (not pending_review or is_hidden);

alter table stores drop constraint if exists stores_pending_is_blocked;
alter table stores add constraint stores_pending_is_blocked check (not pending_review or is_blocked);

alter table exhibitions drop constraint if exists exhibitions_pending_is_hidden;
alter table exhibitions add constraint exhibitions_pending_is_hidden check (not pending_review or is_hidden);

-- ─────────────────────────────────────────────
-- 3) 전시 지우기 막기 (cascade → restrict)
-- ─────────────────────────────────────────────
alter table exhibitions drop constraint if exists exhibitions_store_id_fkey;
alter table exhibitions add constraint exhibitions_store_id_fkey
  foreign key (store_id) references stores(id) on delete restrict;

alter table exhibition_wishes drop constraint if exists exhibition_wishes_exhibition_id_fkey;
alter table exhibition_wishes add constraint exhibition_wishes_exhibition_id_fkey
  foreign key (exhibition_id) references exhibitions(id) on delete restrict;
