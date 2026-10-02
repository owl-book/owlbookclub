# 🦉 부엉이서재

**동네책방 독서모임, 날짜별로 한눈에**

배포 URL: https://owlbookclub.vercel.app

## 서비스 소개

| | |
|---|---|
| **문제** | 동네책방 독서모임 정보는 책방마다 인스타그램·블로그·네이버폼에 흩어져 있어서, "이번 주말에 갈 수 있는 모임"을 찾으려면 여러 곳을 일일이 뒤져야 합니다. |
| **해결** | 서울·경기 동네책방 모임을 한곳에 모아 날짜·지역·장르·모임 방식으로 걸러 보고, 마음에 드는 모임은 책방 신청 페이지로 바로 연결합니다. |
| **기대효과** | 독서모임에 처음 가 보려는 사람은 탐색 시간이 줄고, 작은 책방은 새 손님을 만날 수 있습니다. |

- **주요 타깃**: 독서모임에 관심은 있지만 어디서부터 찾아야 할지 모르는 20~40대 직장인·대학생
- **핵심 행동(CTA)**: 모임 카드에서 **「책방에서 신청하기」** 버튼을 눌러 책방 신청 페이지로 이동

## 기술 스택

- **Next.js 16** (App Router, 서버 컴포넌트) · **React 19** · **TypeScript**
- **Tailwind CSS v4**: 디자인 토큰(색·글꼴·라운드)을 `globals.css`의 `@theme`으로 정의
- **Supabase** (PostgreSQL): 모임·책방·찜·기록 데이터
- **Vercel**: 배포
- 글꼴: Pretendard(본문), Cafe24 아네모네(제목)

## 구현한 인터랙션

| 인터랙션 | 설명 | 파일 |
|---|---|---|
| 날짜 빠른 필터 | 전체 / 이번 주말 / 평일 저녁 칩으로 바로 거르기 | `src/components/FilterBar.tsx` |
| 주간·월간 달력 | 모임 있는 날에 점 표시, 한 달 달력 펼치기/접기, 날짜 탭으로 거르기 | `src/components/FilterBar.tsx` |
| 검색 + 상세 필터 | 지역(시·도 → 구)·장르·모임 방식 드롭다운, 검색어 입력 | `src/components/FilterBar.tsx` |
| 신청 버튼(CTA) | 클릭 시 외부 책방 페이지로 이동하며 클릭 기록 | `src/components/ApplyButton.tsx` |
| 찜하기 | 하트 토글, 마이페이지에서 모아 보기 | `src/components/WishButton.tsx` |
| 공유하기 | 모바일은 공유 시트, 데스크톱은 링크 복사 + 완료 안내 | `src/components/ShareButton.tsx` |
| 모임 후기 별점 | 별점 입력 | `src/components/RatingInput.tsx` |
| 인앱 브라우저 안내 | 카카오톡 등 인앱 브라우저에서 외부 브라우저 열기 안내 | `src/components/OpenExternalBrowser.tsx` |

## 화면 구성

- `/` 모임 목록 (소개 문구 → 필터·달력 → 날짜별 모임 카드)
- `/m/[id]` 모임 상세
- `/me` 마이페이지 (찜·참여 기록), `/login` 간편 로그인
- `/privacy`, `/terms` 개인정보처리방침·이용약관

## 실행 방법

Node.js 20 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run dev                  # http://localhost:3000
```

`.env.local`에 최소한 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 있어야 모임 목록이 보입니다.
DB 표는 `supabase/migrations/` 의 SQL을 번호 순서대로 Supabase SQL Editor에서 실행하고, 예시 데이터는 `supabase/seed_example.sql`로 넣습니다.

```bash
npm run build && npm start   # 배포용 빌드 확인
```

## 다음에 할 일

- shadcn/ui 도입으로 버튼·카드 컴포넌트 정리
- 오픈그래프 이미지 추가, Lighthouse 점검
- GitHub ↔ Vercel 자동 배포 연결
- 간편 로그인(카카오·네이버·구글) 키 연결
