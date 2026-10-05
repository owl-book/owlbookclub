import { Bone, LoadingNote, MeetingListSkeleton } from "@/components/Skeleton";

// 마이페이지를 불러오는 동안: 기본정보 칸(부엉이 얼굴은 그대로) → 탭 → 목록 자리를 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-5">
      <LoadingNote>마이페이지를 불러오는 중</LoadingNote>
      <div aria-hidden>
        <div className="flex items-center gap-3.5 rounded-md border border-border-card bg-card p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--illustration-cream)] text-2xl">🦉</span>
          <div className="min-w-0 flex-1">
            <Bone className="h-6 w-28" />
            <Bone className="mt-1.5 h-3 w-40" />
          </div>
          <Bone className="h-11 w-24 rounded-sm" />
        </div>

        <div className="-mx-4 mt-5 flex border-b border-border px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-12 flex-1 items-center justify-center">
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <MeetingListSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
