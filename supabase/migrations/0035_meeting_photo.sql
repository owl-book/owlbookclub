-- 모임 '대표 사진' 칸 추가 (2026-10-30): 승인 화면(/admin/review)에서 모임마다 사진을 직접 올린다(예: 영화 모임의 영화 포스터).
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0034 다음에 실행, 시험용 DB 먼저)
-- 쓰는 법: photo_path 에 보관함(meeting-photos) 안의 파일 이름이 들어간다. 비워 두면(null) 지금처럼
--   고른 부엉이 그림(cover_art) → 책 표지 → 모임 종류별 그림 순으로 보인다. 사진이 있으면 그 무엇보다 먼저 보인다.
--   묶음 모임도 회차마다 따로 올린다(매달 다른 영화를 보는 모임처럼 회차마다 사진이 달라서).
alter table meetings add column if not exists photo_path text;

-- 사진 보관함. 누구나 사진 주소로 볼 수 있지만(공개), 올리기·지우기는 서버만 한다.
-- 올리기 전에 화면에서 가로 480px JPG 로 줄여서 보내므로 1MB 이하로 제한한다(책 표지 0017 과 같은 값).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-photos', 'meeting-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────
-- 출석 체크(맨 끝). 결과 칸에 '0035 출석 완료'가 보이면 성공
-- ─────────────────────────────────────────────
insert into applied_migrations (version, name) values ('0035', 'meeting_photo') on conflict (version) do nothing;

select version || ' 출석 완료' as 결과, applied_at as 실행한_시각 from applied_migrations where version = '0035';
