-- 책방 상세 화면(/s/책방번호)의 '한 줄 소개'
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0011 다음에 실행)
-- 비워 두면 화면에서 소개 줄만 빠진다. 책방 홍보 문구가 아니라 '어떤 책방인지' 한 줄(40자 안팎)로 적는다.
-- 예: '골목 2층, 소설이 많은 작은 책방'

alter table stores add column if not exists intro text;
