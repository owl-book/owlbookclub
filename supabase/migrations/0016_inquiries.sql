-- 풋바 '의견·요청 보내기'(/contact)로 들어오는 문의를 받고, 관리자 신고함(/admin/reports)에서 처리한다
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0015 다음에 실행)
-- 다른 표와 마찬가지로 RLS 를 켜고 정책을 두지 않는다 → 브라우저에서는 접근 불가, 서버만 읽고 쓴다.
--
-- 종류(category)와 보기(topic)는 앱 파일 src/lib/inquiry-kinds.ts 와 같은 값이다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.
--   info    정보가 달라요            store · meeting · book
--   suggest 새 책방·모임을 알려드려요  new
--   site    그 밖의 문의             bug · account · idea · pause(게시 멈추기·빼기) · other
--
-- 보관: 연락처는 처리를 마친 날로부터 3개월 뒤, 내용은 6개월 뒤 서버가 지운다.
--       여러 번 보내기를 막는 값(ip_hash, visitor_id)은 7일 뒤 비운다.

create table if not exists inquiries (
  id           bigint generated always as identity primary key,
  category     text not null check (category in ('info', 'suggest', 'site')),
  topic        text not null check (topic in ('store', 'meeting', 'book', 'new', 'pause', 'bug', 'account', 'idea', 'other')),
  store_id     bigint references stores(id) on delete set null, -- 사이트에 있는 책방을 고른 경우
  store_name   text check (char_length(store_name) <= 100),    -- 아직 없는 책방 이름(새 책방 알려주기)
  link         text check (char_length(link) <= 300),          -- 인스타·신청 페이지 주소. 신고함에서 글자로만 보여 준다
  message      text check (char_length(message) <= 1000),
  contact      text check (char_length(contact) <= 100),       -- 답장 받을 연락처(이메일·전화·인스타 아이디)
  status       text not null default 'open' check (status in ('open', 'done')),
  resolved_at  timestamptz,
  ip_hash      text,
  visitor_id   text,
  created_at   timestamptz not null default now()
);
create index if not exists inquiries_open_idx on inquiries (created_at desc) where status = 'open';
create index if not exists inquiries_ip_idx on inquiries (ip_hash, created_at);
alter table inquiries enable row level security;

revoke all on inquiries from anon, authenticated;
