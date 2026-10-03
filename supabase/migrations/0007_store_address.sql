-- 책방 주소 칸 추가: 모임 상세화면 '장소' 줄에 주소와 지도 열기 링크를 보여 준다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다.
-- 주소는 도로명 주소로 적는다(예: '경기 고양시 일산동구 정발산로 24 2층'). 비워 두면 화면에 '책방 신청 페이지에서 확인'으로 보인다.

alter table stores add column if not exists address text;
