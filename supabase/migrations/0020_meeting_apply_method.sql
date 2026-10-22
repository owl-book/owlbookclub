-- 모임 '신청 방식' 칸 추가: 신청 버튼 글자를 신청 방식에 맞게 바꿔 보여 줄 때 쓴다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0019 다음에 실행)
-- 값:
--   'form' (기본) 신청서·예약 페이지로 신청 → '책방에서 신청하기 ↗'
--   'dm'          인스타 DM으로 신청 → '인스타 DM으로 신청하기 ↗' (apply_url 에 책방 인스타 계정 주소)
--   'none'        신청 없이 자유 방문 → 버튼 대신 '신청 없이 자유롭게 오시면 돼요' (apply_url 에는 게시물 주소를 넣어 둔다)
alter table meetings add column if not exists apply_method text not null default 'form';
alter table meetings drop constraint if exists meetings_apply_method_check;
alter table meetings add constraint meetings_apply_method_check check (apply_method in ('form', 'dm', 'none'));
