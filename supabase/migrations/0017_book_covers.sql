-- 책 표지 사진을 운영자가 직접 올린다(책 API 연결 전 · 연결 후에도 직접 올린 사진이 먼저 보인다).
-- 책마다 한 번만 올린다: 모임의 책 제목(book_title_text)에서 띄어쓰기·『』 같은 괄호·대소문자를 뺀 값(title_key)이 같으면 같은 책으로 본다.
-- 관리자 화면 /admin/covers 에서 올리고 바꾸고 뺀다.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0016 다음에 실행)

create table if not exists book_covers (
  title_key   text primary key,                 -- 앱 파일 src/lib/book-covers.ts 의 titleKey() 로 만든 값
  title       text not null,                    -- 처음 올릴 때의 책 제목(보기용)
  image_path  text not null,                    -- 보관함(book-covers) 안의 파일 이름
  updated_at  timestamptz not null default now()
);
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
alter table book_covers enable row level security;

-- 사진 보관함. 누구나 사진 주소로 볼 수 있지만(공개), 올리기·지우기는 서버만 한다.
-- 사진은 올리기 전에 화면에서 가로 480px JPG 로 줄여서 보내므로 1MB 이하로 제한한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
