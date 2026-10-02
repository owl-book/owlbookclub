@AGENTS.md

# 부엉이서재 — 프로젝트 컨텍스트

## 서비스 목적
흩어진 서울·경기 동네책방 독서모임을 날짜별로 모아 보여 주고, 책방 신청 페이지로 연결한다.
신청·결제는 각 책방에서 한다. 우리는 정보를 모으고 연결만 한다.

## 기술 스택
- Next.js 16 App Router(서버 컴포넌트 기본, 상호작용이 필요한 부품만 `"use client"`), React 19, TypeScript
- Tailwind CSS v4: 디자인 토큰은 `src/app/globals.css`의 `@theme`에 있다
- Supabase(PostgreSQL): 서버에서만 접근(`src/lib/db.ts`), 스키마는 `supabase/migrations/`
- 배포: Vercel

## 디자인 원칙 (디자인 시스템 v2.2)
- 모바일 우선, 본문 폭 `max-w-xl`
- 색은 토큰 이름으로만 쓴다(`bg-navy`, `text-ink-2` 등). 임의 HEX 금지
- 앰버(`amber`)는 화면당 1번, 되돌리기 어려운 행동(책방 사이트로 나가기)에만 쓴다
- 페이지 전체 다크모드는 쓰지 않는다
- 제목은 `font-display`(Cafe24 아네모네), 본문은 Pretendard
- 누르는 영역은 최소 44px(`min-h-11`)

## 작업 규칙
- 답변과 설명은 한국어, 비전공자도 이해할 수 있는 쉬운 말로
- 지역·장르·모임 방식 목록은 앱 파일(`src/lib/regions.ts`, `src/lib/tags.ts`)과 DB 표를 함께 수정한다
- 비밀 열쇠는 `.env.local`에만 두고 커밋하지 않는다. 새 열쇠는 `.env.example`에 이름만 추가한다
- 수정 후 `npm run build`가 통과하는지 확인하고, 화면은 모바일 폭에서 직접 확인한다
- 반복되는 UI는 `src/components/`에 재사용 부품으로 만든다
