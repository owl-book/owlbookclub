import { Bone, LoadingNote } from "@/components/Skeleton";

// 책방 모아보기를 불러오는 동안: 제목·지역 칸·책방 카드 자리를 미리 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-5">
      <LoadingNote>책방 목록을 불러오는 중</LoadingNote>
      <div aria-hidden>
        <Bone className="h-9 w-2/3" />
        <Bone className="mt-3 h-4 w-4/5" />
        <div className="mt-5 flex gap-2">
          <Bone className="h-11 w-16 rounded-full" />
          <Bone className="h-11 w-20 rounded-full" />
          <Bone className="h-11 w-20 rounded-full" />
        </div>
        <Bone className="mt-5 h-5 w-full" />
        <ul className="mt-3 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="rounded-md border border-border-card bg-card p-4">
              <Bone className="h-4 w-20" />
              <Bone className="mt-2 h-6 w-1/2" />
              <Bone className="mt-2 h-4 w-4/5" />
              <Bone className="mt-3 h-4 w-32" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
