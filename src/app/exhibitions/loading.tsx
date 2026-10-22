import { Bone, LoadingNote } from "@/components/Skeleton";

// 전시 소식을 불러오는 동안: 제목·지역 칸·포스터 카드 자리를 미리 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-5">
      <LoadingNote>전시 소식을 불러오는 중</LoadingNote>
      <div aria-hidden>
        <Bone className="h-9 w-2/3" />
        <Bone className="mt-3 h-4 w-4/5" />
        <div className="mt-5 flex gap-2">
          <Bone className="h-11 w-16 rounded-full" />
          <Bone className="h-11 w-20 rounded-full" />
        </div>
        <Bone className="mt-6 h-6 w-32" />
        <ul className="mt-3 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex gap-3.5 rounded-md border border-border-card bg-card p-4">
              <Bone className="h-[128px] w-[96px] shrink-0 rounded-xs" />
              <div className="min-w-0 flex-1">
                <Bone className="h-4 w-24" />
                <Bone className="mt-2 h-6 w-3/4" />
                <Bone className="mt-2 h-4 w-1/2" />
                <Bone className="mt-4 h-5 w-20" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
