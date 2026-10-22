-- 책방 전시 소식: 책방 안에서 여는 그림·사진 전시, 그림책 원화전, 팝업·굿즈 행사.
-- 독자가 전시를 보러 책방에 직접 가 보게 하는 게 목적이라, 작품 사진은 싣지 않고 포스터 한 장만 쓴다(작품은 책방에 가서 본다).
-- 모임과 같은 흐름: Claude가 모임 정리할 때 함께 '숨긴 채로' 넣고 → 운영자 화면(/admin/review)에서 승인하면 공개.
-- 포스터는 책방 허가를 받은 뒤에만 공개한다(승인 버튼이 한 번 더 묻는다).
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮다. (0023 다음에 실행)
--
-- 넣는 법(대기 전시):  is_hidden = true, pending_review = true, review_note = '확인할 점'(선택)
-- 승인:    is_hidden = false, pending_review = false
-- 넣지 않음: pending_review = false 만 바꾸고 숨김은 그대로 둔다(지우지 않는다)

create table if not exists exhibitions (
  id              bigint generated always as identity primary key,
  store_id        bigint not null references stores(id) on delete cascade,
  title           text not null check (char_length(title) <= 120),
  kind            text not null check (kind in ('전시', '원화전', '팝업')), -- 그림·사진 전시 / 그림책 원화전 / 팝업·굿즈 행사
  artist          text check (char_length(artist) <= 120),                 -- 작가 이름(여럿이면 쉼표로)
  starts_on       date not null,                                           -- 첫날(한국 날짜)
  ends_on         date not null,                                           -- 마지막 날(이날까지 볼 수 있음)
  hours_note      text check (char_length(hours_note) <= 200),             -- 전시 시간이 책방 운영시간과 다를 때만
  is_paid         boolean not null default false,                          -- 대부분 무료라 유료일 때만 표시한다
  fee_note        text check (char_length(fee_note) <= 60),                -- 유료일 때 금액('5,000원'). 모르면 비워 둔다
  intro           text check (char_length(intro) <= 2000),                 -- 짧은 소개(책방 게시물을 옮겨 적음)
  post_url        text,                                                    -- 책방 인스타 게시물 원문
  poster_path     text,                                                    -- 보관함(exhibition-posters) 안의 파일 이름
  poster_width    int,                                                     -- 포스터 원래 비율로 자리를 잡아 두려고(화면이 덜컹이지 않게)
  poster_height   int,
  is_hidden       boolean not null default true,
  pending_review  boolean not null default false,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists exhibitions_store_idx on exhibitions (store_id, ends_on);
create index if not exists exhibitions_pending_review_idx on exhibitions (starts_on) where pending_review;

-- 전시 찜: 회원 탈퇴(users 삭제) 시 함께 지워진다
create table if not exists exhibition_wishes (
  user_id        uuid not null references users(id) on delete cascade,
  exhibition_id  bigint not null references exhibitions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, exhibition_id)
);
create index if not exists exhibition_wishes_exhibition_idx on exhibition_wishes (exhibition_id, created_at);

-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
alter table exhibitions enable row level security;
alter table exhibition_wishes enable row level security;

-- 포스터 보관함. 누구나 사진 주소로 볼 수 있지만(공개), 올리기·지우기는 서버만 한다.
-- 올리기 전에 화면에서 긴 쪽 1600px JPG 로 줄여서 보내므로 2MB 이하로 제한한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exhibition-posters', 'exhibition-posters', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
