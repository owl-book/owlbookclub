import { Bone, LoadingNote } from "@/components/Skeleton";

// 운영자 화면(승인 대기·신고함·책 표지·알림·통계)을 불러오는 동안. 다섯 화면이 모두 이 화면을 쓴다.
// 위쪽 탭 자리와 카드 몇 장만 잡아 두고, 무엇을 불러오는지 글자로도 알려 준다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-4">
      <LoadingNote>운영자 화면을 불러오는 중</LoadingNote>
      <p className="text-l1 font-semibold text-ink-2">운영자 화면</p>

      <div aria-hidden>
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="h-11 w-20 shrink-0 rounded-sm" />
          ))}
        </div>

        <Bone className="mt-6 h-8 w-1/2" />
        <Bone className="mt-3 h-4 w-4/5" />

        <ul className="mt-6 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="rounded-md border border-border-card bg-card p-4">
              <Bone className="h-4 w-24" />
              <Bone className="mt-2.5 h-5 w-3/4" />
              <Bone className="mt-2 h-4 w-1/2" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
