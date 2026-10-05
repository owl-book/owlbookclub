import type { ReactNode } from "react";

// 화면을 불러오는 동안 보여 주는 뼈대 조각들(loading.tsx 에서 쓴다).
// 실제 화면과 같은 자리·크기를 잡아 두어, 내용이 들어와도 화면이 밀리지 않게 한다.

// 글자·사진 자리를 대신하는 옅은 막대. 크기는 className 으로 정한다
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`owl-bone rounded-xs bg-fill ${className}`} />;
}

// 화면 읽기 프로그램에 '불러오는 중'을 알리는 문장(눈에는 보이지 않음)
export function LoadingNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

// MeetingCard 와 같은 모양: 책 표지(72×108) + 시각·제목·책·책방 줄 + 태그
export function MeetingCardSkeleton({ hideStore }: { hideStore?: boolean }) {
  return (
    <div aria-hidden className="flex gap-3.5 rounded-md border border-border-card bg-card p-4">
      <Bone className="h-[108px] w-[72px] shrink-0" />
      <div className="min-w-0 flex-1">
        <Bone className="h-4 w-16" />
        <Bone className="mt-2.5 h-5 w-4/5" />
        <Bone className="mt-2 h-4 w-3/5" />
        {!hideStore && <Bone className="mt-1.5 h-4 w-2/5" />}
        <div className="mt-3 flex gap-1.5">
          <Bone className="h-6 w-12" />
          <Bone className="h-6 w-14" />
          <Bone className="h-6 w-10" />
        </div>
      </div>
    </div>
  );
}

// MeetingList 와 같은 모양: 날짜 제목 한 줄 + 카드 몇 장
export function MeetingListSkeleton({ count = 3, hideStore }: { count?: number; hideStore?: boolean }) {
  return (
    <div aria-hidden>
      <div className="py-2">
        <Bone className="h-4 w-36" />
      </div>
      <ul className="mt-1 space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <MeetingCardSkeleton hideStore={hideStore} />
          </li>
        ))}
      </ul>
    </div>
  );
}
