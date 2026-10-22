# 🦉 부엉이들의서재

**동네책방 독서모임, 날짜별로 한눈에**

- 배포 URL: https://www.owlbookclub.com (예전 주소 https://owlbookclub.vercel.app 도 그대로 열림)
- GitHub: https://github.com/owl-book/owlbookclub

## 서비스 소개

| | |
|---|---|
| **문제** | 동네책방 독서모임 정보는 책방마다 인스타그램·블로그·네이버폼에 흩어져 있어서, "이번 주말에 갈 수 있는 모임"을 찾으려면 여러 곳을 일일이 뒤져야 합니다. |
| **해결** | 서울·경기 동네책방 모임을 한곳에 모아 날짜·지역·장르·모임 방식으로 걸러 보고, 마음에 드는 모임은 책방 신청 페이지로 바로 연결합니다. |
| **기대효과** | 독서모임에 처음 가 보려는 사람은 탐색 시간이 줄고, 작은 책방은 새 손님을 만날 수 있습니다. |

- **주요 타깃**: 독서모임에 관심은 있지만 어디서부터 찾아야 할지 모르는 20~40대 직장인·대학생
- **핵심 행동(CTA)**: 모임 카드에서 **「책방에서 신청하기」** 버튼을 눌러 책방 신청 페이지로 이동
- 신청·결제는 각 책방에서 합니다. 부엉이들의서재는 정보를 모으고 연결만 합니다.

## 기술 스택

- **Next.js 16** (App Router, 서버 컴포넌트, Server Actions) · **React 19** · **TypeScript**
- **Tailwind CSS v4**: 디자인 토큰(색·글꼴·라운드)을 `globals.css`의 `@theme`으로 정의
- **Supabase**: PostgreSQL(데이터) + Storage(책 표지·전시 포스터 사진)
- **Vercel**: 배포
- 글꼴: Pretendard(본문), Cafe24 아네모네(제목)

---

## 핵심 기능 명세

서비스의 핵심 가치("흩어진 모임 정보를 믿을 수 있게 한곳에")를 검증하는 CRUD 흐름 두 가지를 선정했습니다.

| | ① 모임 정보 관리 (운영자) | ② 내 참여 기록 (회원) |
|---|---|---|
| 검증하려는 것 | 정확한 모임 정보를 빠르게 올리고 고칠 수 있는가 | 다녀온 모임을 기록하러 다시 돌아오는가 |
| 데이터 | `meetings`, `stores`, `book_covers` + Storage | `meeting_records` |
| 처리 방식 | Server Actions (`src/lib/review-actions.ts`, `admin-actions.ts`, `cover-actions.ts`) | Server Actions (`src/lib/me-actions.ts`) |
| 접근 | 관리자 비밀번호(`ADMIN_PASSWORD`) | 간편 로그인(카카오·구글) 본인만 |

### ① 모임 정보 관리

일반적인 게시판과 달리, 모임은 운영자가 책방 공지를 보고 정리해서 올립니다. 잘못된 정보가 바로 공개되지 않도록 **"숨긴 채로 등록 → 승인 화면에서 확인·수정 → 공개"** 흐름을 씁니다. 공개된 모임은 지우지 않고 **숨기기**로 내립니다(찜·기록이 모임에 연결돼 있어서).

**사용자 흐름**: 승인 대기 목록 → 미리보기(상세) → 고치기 → 공개 / 넣지 않음 → 공개 목록·상세 → 신고 처리(마감·숨기기·일정 수정)

| 화면 | 주소 | 입력 / 사용자 행동 | 성공 결과 | 실패 결과 |
|---|---|---|---|---|
| **Create** 등록 | (운영 도구) | 모임 정보를 `pending_review = true`, `is_hidden = true`로 DB에 저장 | 승인 대기 목록에 나타남 | 필수값이 없으면 DB 제약조건으로 저장 거부 |
| **Read** 승인 대기 목록 | `/admin/review` | 책방별 대기 모임 확인 | 책방·모임 카드 목록 | 대기 없음 → 빈 상태 안내 |
| **Read** 미리보기(상세) | `/admin/review/[id]` | 카드에서 미리보기 누르기 | 공개 화면과 같은 상세 화면 | 없는 번호·이미 처리한 모임 → 없는 페이지 안내 |
| **Update** 고치기 | `/admin/review` 안 고치기 폼 | 제목, 일시, 끝나는 시각, 장르, 모임 방식, 신청 링크, 장소, 참가비, 소개 등 | 저장 후 "고쳤어요" 안내, 바뀐 값 표시 | 제목 빈칸·일시 형식 오류·끝나는 시각이 시작보다 빠름·링크 형식 오류 → 해당 칸 오류 안내 |
| **Update** 공개(승인) | `/admin/review` | 「공개하기」 | 홈 목록·상세에 바로 보임. 같은 묶음 회차·대기 중인 책방도 함께 공개 | 신청 링크가 비어 있으면 공개를 막고 "신청 링크가 비어 있어서 승인하지 않았어요" 안내 |
| **Delete** 넣지 않음 / 숨기기 | `/admin/review`, `/admin/reports` | 「넣지 않음」, 신고 처리 「숨기기」 | 목록·상세에서 사라짐(데이터는 보관, 변경 전·후 값을 `admin_actions`에 기록) | 이미 처리한 모임 → "화면을 새로 고쳐 주세요" |
| **파일** 책 표지 | `/admin/covers` | 표지 사진 고르기 → 올리기 / 빼기 | 모임 카드·상세에 표지 표시 | 사진 없음·1MB 초과·JPG/PNG/WEBP 아님 → 오류 안내. 표지가 없으면 디자인 표지로 대신 표시 |
| **Read** 공개 목록 | `/` | 날짜·지역·장르·모임 방식·검색어 | 날짜별 모임 카드 | 조건에 맞는 모임 없음 → 빈 상태 안내 |
| **Read** 공개 상세 | `/m/[id]` | 카드 누르기 | 모임 상세, 신청 버튼 | 없는 번호·숨긴 모임 → 없는 페이지 안내 |

### ② 내 참여 기록

다녀온 모임에 별점, 인상 깊은 문장, 메모를 남깁니다. 기록은 본인만 볼 수 있습니다.

**사용자 흐름**: 마이페이지 「내 모임」 목록 → 다녀왔어요 표시 → 기록 쓰기(등록) → 목록에서 다시 열기(상세) → 고치기 → 지우기

| 화면 | 주소 | 입력 / 사용자 행동 | 성공 결과 | 실패 결과 |
|---|---|---|---|---|
| **Read** 목록 | `/me?tab=mine` | 로그인 후 마이페이지 | 신청·다녀온 모임과 기록 여부 표시 | 로그인 안 함 → 로그인 화면. 모임 없음 → 빈 상태 안내 |
| **Create** 기록 쓰기 | `/me/records/[meetingId]` | 별점(1~5), 인상 깊은 문장(500자), 메모(5000자) | 저장 후 마이페이지로 돌아가 "기록을 저장했어요" 안내 | 아직 안 지난 모임 → 기록 불가. 글자 수 초과 → 입력 제한 |
| **Read** 기록 보기(상세) | `/me/records/[meetingId]` | 목록에서 기록 누르기 | 저장한 값이 채워진 화면 | 없는 모임 번호 → 없는 페이지 안내 |
| **Update** 고치기 | `/me/records/[meetingId]` | 값 바꾸고 저장 | `updated_at` 갱신, 목록에 반영 | 저장 실패 → 오류 안내 |
| **Delete** 지우기 | `/me/records/[meetingId]` | 「기록 지우기」 → 확인 창 | 확인하면 삭제, "기록을 지웠어요" 안내 | 확인 창에서 취소 → 그대로 유지 |

공통 처리
- 저장 버튼은 처리 중에 눌리지 않게 막고 버튼 문구를 "저장하는 중…"처럼 바꿔 보여 줍니다(`src/components/SubmitButton.tsx`).
- 되돌릴 수 없는 행동은 확인 창으로 한 번 더 묻습니다(`SubmitButton`의 `confirm`, `ConfirmSubmit.tsx`).
- 화면을 불러오는 동안 뼈대 화면(`loading.tsx`, `src/components/Skeleton.tsx`)을 보여 줍니다.
- 없는 주소는 안내 화면(`src/app/not-found.tsx`, `src/app/m/[id]`, `src/app/s/[id]/not-found.tsx`)으로 보냅니다.

---

## 테이블 구조

모든 표는 RLS를 켜고 정책을 두지 않았습니다. 브라우저에서는 직접 접근할 수 없고, 서버(`src/lib/db.ts`)만 읽고 씁니다. 전체 설정문은 `supabase/migrations/`에 번호 순서대로 있습니다.

### `meetings` 모임

| 칸 | 종류 | 필수 | 설명 |
|---|---|---|---|
| `id` | bigint (자동 증가) | ✅ | 고유 번호 |
| `store_id` | bigint → `stores.id` | ✅ | 여는 책방 |
| `title` | text | ✅ | 모임 이름 |
| `starts_at` | timestamptz | ✅ | 시작 일시 |
| `ends_at` | timestamptz | | 끝나는 시각(시작보다 뒤여야 함) |
| `time_note` | text (60자) | | 반별 시간 안내 |
| `tag_genre` | text | ✅ | 장르 |
| `tag_format` | text | ✅ | 모임 방식 |
| `tag_cadence` | text (`정기`/`일일`) | ✅ | 정기·일일 |
| `apply_method` | text (`form`/`dm`/`none`) | ✅ | 신청 방법 |
| `apply_url` | text | ✅ | 책방 신청 링크 |
| `post_url` | text | | 원 게시물 링크 |
| `book_title_text`, `book_author_text` | text | | 함께 읽는 책 |
| `place`, `fee_text` | text | | 장소, 참가비 |
| `description` | text (1000자) | | 모임 소개 |
| `series_key` | text (40자) | | 한 번에 신청하는 회차 묶음 |
| `status` | text (`open`/`closed`) | ✅ | 모집 중 / 마감 |
| `is_hidden` | boolean | ✅ | 숨김(공개 화면에서 빠짐) |
| `pending_review` | boolean | ✅ | 승인 대기 |
| `review_note` | text | | 승인 화면용 메모 |
| `created_at` | timestamptz | ✅ | 만든 시각 |
| `last_checked_at` | date | ✅ | 마지막으로 정보를 확인·수정한 날 |

### `meeting_records` 내 참여 기록

| 칸 | 종류 | 필수 | 설명 |
|---|---|---|---|
| `id` | bigint (자동 증가) | ✅ | 고유 번호 |
| `user_id` | uuid → `users.id` | ✅ | 기록한 회원(탈퇴하면 함께 삭제) |
| `meeting_id` | bigint → `meetings.id` | ✅ | 다녀온 모임 |
| `rating` | smallint (1~5) | | 나만 보는 별점 |
| `quote` | text (500자) | | 인상 깊은 문장 |
| `memo` | text (5000자) | | 자유 메모 |
| `created_at`, `updated_at` | timestamptz | ✅ | 만든 시각, 고친 시각 |

`(user_id, meeting_id)`는 한 쌍만 있을 수 있습니다(모임 하나에 기록 하나).

### `book_covers` 책 표지 + Storage

| 칸 | 종류 | 필수 | 설명 |
|---|---|---|---|
| `title_key` | text (기본 키) | ✅ | 책 제목으로 만든 고유 값. 모임의 `book_title_text`와 연결 |
| `title` | text | ✅ | 책 제목 |
| `image_path` | text | ✅ | Storage `book-covers` 보관함 안의 파일 이름 |
| `updated_at` | timestamptz | ✅ | 바꾼 시각 |

Storage 보관함 `book-covers`: 공개 읽기, 1MB 이하, `image/jpeg`·`image/png`·`image/webp`만 허용. 사진은 올리기 전에 화면에서 가로 480px로 줄입니다.

### 그 밖의 표

`stores`(책방), `users`(회원), `meeting_wishes`·`store_wishes`(찜), `meeting_plans`(신청·참석 표시), `reports`(정보 오류 신고), `inquiries`(의견), `admin_actions`(운영자 변경 기록), `exhibitions`(책방 전시), `events`(이용 기록)

### 데이터 처리 규칙

- DB 접근은 서버에서만 합니다. 비밀 열쇠(`SUPABASE_SERVICE_ROLE_KEY`)는 브라우저로 보내지 않습니다.
- 모든 저장 동작은 맨 앞에서 관리자 또는 로그인 본인인지 다시 확인합니다. 기록의 읽기·쓰기·지우기에는 항상 `user_id = 본인` 조건을 붙입니다.
- 공개된 모임은 지우지 않고 숨깁니다. 운영자가 바꾼 내용은 `admin_actions`에 변경 전·후 값으로 남깁니다.
- 지난 모임 여부는 저장하지 않고 `starts_at`으로 그때그때 계산합니다.
- 지역·장르·모임 방식 목록은 앱 파일(`src/lib/regions.ts`, `src/lib/tags.ts`)과 DB 표를 함께 고칩니다.

---

## 화면 구성

- `/` 모임 목록 (필터·달력 → 날짜별 모임 카드)
- `/m/[id]` 모임 상세, `/s/[id]` 책방 상세, `/stores` 책방 목록
- `/exhibitions`, `/e/[id]` 책방 전시 소식
- `/me` 마이페이지(찜·내 모임), `/me/records/[meetingId]` 모임 기록, `/login` 간편 로그인
- `/admin/review` 승인 대기, `/admin/reports` 신고함, `/admin/covers` 책 표지 (관리자)
- `/contact`, `/privacy`, `/terms` 문의·개인정보처리방침·이용약관

## 구현한 인터랙션

| 인터랙션 | 설명 | 파일 |
|---|---|---|
| 날짜 빠른 필터 | 전체 / 이번 주말 / 평일 저녁 칩으로 바로 거르기 | `src/components/FilterBar.tsx` |
| 주간·월간 달력 | 모임 있는 날에 점 표시, 한 달 달력 펼치기/접기 | `src/components/FilterBar.tsx` |
| 검색 + 상세 필터 | 지역·장르·모임 방식, 검색어. 조건은 주소 뒤 쿼리(`?q=…`)에 담겨 새로고침·공유해도 유지 | `src/components/FilterBar.tsx` |
| 신청 버튼(CTA) | 외부 책방 페이지로 이동하며 클릭 기록 | `src/components/ApplyButton.tsx` |
| 찜하기 | 하트 토글, 누르는 즉시 화면 반영 | `src/components/WishButton.tsx` |
| 공유하기 | 모바일은 공유 시트, 데스크톱은 링크 복사 | `src/components/ShareButton.tsx` |
| 모임 기록 별점 | 별점 입력 | `src/components/RatingInput.tsx` |
| 정보 오류 신고 | 상세 화면에서 마감·정보 오류 알리기 | `src/components/ReportSheet.tsx` |

---

## 실행 방법

Node.js 20 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 환경 변수 참고)
npm run dev                  # http://localhost:3000
```

DB 표는 `supabase/migrations/`의 SQL을 번호 순서대로 Supabase SQL Editor에서 실행하고, 예시 데이터는 `supabase/seed_example.sql`로 넣습니다.

```bash
npm run build && npm start   # 배포용 빌드 확인
```

## 환경 변수

실제 값은 `.env.local`(내 컴퓨터)과 Vercel 프로젝트 설정에만 넣고, GitHub에는 올리지 않습니다. 이름과 설명은 `.env.example`에 있습니다.

| 이름 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase 프로젝트 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 DB 열쇠 |
| `NEXT_PUBLIC_SITE_URL` | ✅ | 배포 주소(공유 미리보기) |
| `ADMIN_PASSWORD` | 관리 화면 | 관리자 화면 비밀번호(16자 이상) |
| `AUTH_SECRET` | 로그인 | 로그인 쿠키 서명 |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | 로그인 | 카카오 로그인 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 로그인 | 네이버 로그인 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 로그인 | 구글 로그인 |
| `ALADIN_TTB_KEY` | | 책 정보 API |
| `NEXT_PUBLIC_CONTACT_EMAIL` | | 문의 메일 주소 |
| `NEXT_PUBLIC_GA_ID` | | 구글 애널리틱스 |

---

## QA 체크리스트

배포 환경(https://www.owlbookclub.com)에서 직접 점검합니다. ✅ 통과 / ❌ 문제 있음 / ⏳ 점검 예정(임시 표시, 점검 후 바꿀 예정)

| # | 시나리오 | 대상 | 기대 결과 | 결과 |
|---|---|---|---|---|
| 1 | 고치기 폼에서 제목을 비우고 저장 | 모임 | "모임 이름을 적어 주세요." 안내, 저장 안 됨 | ⏳ |
| 2 | 일시·끝나는 시각·링크를 잘못된 형식으로 저장 | 모임 | 해당 칸 오류 안내 | ⏳ |
| 3 | 신청 링크가 빈 모임을 공개 | 모임 | 공개 막고 안내 | ⏳ |
| 4 | 기록에 글자 수를 넘게 입력 | 기록 | 더 입력되지 않음 | ⏳ |
| 5 | 대기 모임 공개 후 홈 목록·상세 확인 | 모임 | 목록·상세에 바로 보임 | ⏳ |
| 6 | 기록 저장 후 마이페이지·기록 화면 확인 | 기록 | 목록 버튼이 "기록 보기"로 바뀜, 다시 열면 값 유지 | ⏳ |
| 7 | 저장 뒤 새로고침 | 모임·기록 | 데이터 그대로 | ⏳ |
| 8 | 모임 정보 고친 뒤 상세 확인 | 모임 | 바뀐 값 표시 | ⏳ |
| 9 | 기록 고친 뒤 다시 열기 | 기록 | 바뀐 값 표시 | ⏳ |
| 10 | 모임 숨기기 후 목록·상세 확인 | 모임 | 목록에서 빠지고 상세 주소는 없는 페이지 | ⏳ |
| 11 | 기록 지우기 → 확인 창 취소 / 확인 | 기록 | 취소면 유지, 확인이면 삭제 | ⏳ |
| 12 | `/m/999999`, `/s/999999` 접속 | 모임 | 없는 페이지 안내 | ✅ (10/22) |
| 13 | 표지 사진 없이 올리기 | 파일 | "올릴 사진을 골라 주세요" | ⏳ |
| 14 | 1MB 넘는 사진·사진이 아닌 파일 올리기 | 파일 | 크기·형식 오류 안내 | ⏳ |
| 15 | 표지 없는 책의 모임 카드 | 파일 | 디자인 표지로 대신 표시 | ⏳ |
| 16 | 표지 올린 뒤 상세 화면 | 파일 | 올린 표지 표시 | ⏳ |
| 17 | 저장 버튼 연속으로 누르기 | 공통 | 처리 중에는 눌리지 않음 | ⏳ |

## 다음에 할 일

- 목록 페이지 나누기(또는 더 불러오기)
- 화면을 불러오다 오류가 났을 때의 안내 화면(`error.tsx`)
- `meetings` 표에 고친 시각(`updated_at`) 칸 추가
- 광고 슬라이더, BETA 표시
- PWA(홈 화면에 추가) 및 알림
- 지역 필터에 모임이 있는 지역만 보이게
- 화면 조회 속도 개선
- 홈 화면 UX·UI 개선
