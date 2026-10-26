-- 어드민 '통계'용 새 기록 4가지(봇·운영자 기기 제외는 기존 events 방식 그대로)
--   card_click     목록에서 모임 카드를 눌러 상세 화면으로 감(모임별·책방별)
--   store_view     책방 상세 화면이 열림(props.from: 어디서 왔는지)
--   store_contact  책방 지도·전화·인스타 링크 클릭(props.kind: map|tel|instagram, props.page: store|meeting|exhibition)
--   search_empty   홈에서 검색·필터·날짜를 바꾼 결과가 0건(props: q·지역·장르·모임방식·날짜. 검색어는 이메일·전화번호 모양을 가림)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. (0025 다음에 실행. 배포 전에 실행하면 첫날부터 쌓인다)
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('visit', 'search', 'filter', 'share', 'apply_click', 'report_click', 'post_click', 'login', 'wish', 'record', 'plan',
                  'card_click', 'store_view', 'store_contact', 'search_empty'));
