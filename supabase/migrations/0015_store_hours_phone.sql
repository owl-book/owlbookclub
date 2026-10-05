-- 책방 상세 화면(/s/책방번호)의 '운영시간'·'대표번호'
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0014 다음에 실행)
-- 네이버 플레이스에 적힌 내용을 옮겨 적는다. 화면에 "네이버 플레이스 기준" 안내가 함께 나온다.
-- 비워 두면 화면에서 그 줄만 빠진다.
-- hours: 줄바꿈 그대로 보인다. 화면에서는 줄 맨 앞 요일 기준 월→일 순으로 정렬된다. 예: '월 휴무
-- 화~토 12:00–20:00
-- 일 13:00–18:00'
-- phone: 예: '02-123-4567' (누르면 전화 걸기)

alter table stores add column if not exists hours text;
alter table stores add column if not exists phone text;
