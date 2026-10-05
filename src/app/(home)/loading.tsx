import { Bone, LoadingNote, MeetingListSkeleton } from "@/components/Skeleton";

// 첫 화면을 불러오는 동안: 제목·소개 문장은 늘 같아서 실제 글자로 먼저 보여 주고,
// 검색칸·날짜 고르기·모임 카드 자리는 뼈대로 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-5">
      <LoadingNote>모임 목록을 불러오는 중</LoadingNote>
      <section className="mb-5">
        <h1 className="font-display text-h1 text-ink">
          부엉이들이 여는
          <br />
          독서모임
        </h1>
        <p className="mt-2 text-b2 text-ink-2">서울·경기 동네책방에서 열리는 독서모임을 날짜별로 모아 뒀어요.</p>
      </section>

      <div aria-hidden className="space-y-3">
        <div className="flex gap-2">
          <Bone className="h-11 flex-1" />
          <Bone className="h-11 w-16 rounded-sm" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-11 w-16 rounded-full" />
          <Bone className="h-11 w-16 rounded-full" />
          <Bone className="h-11 w-20 rounded-full" />
          <Bone className="h-11 w-20 rounded-full" />
        </div>
        <Bone className="h-28 rounded-md" />
        <div className="flex items-center justify-between">
          <Bone className="h-3 w-32" />
          <Bone className="h-11 w-20 rounded-full" />
        </div>
      </div>

      <div className="mt-4">
        <MeetingListSkeleton />
      </div>
    </div>
  );
}
