import { BackLink } from "@/components/BackLink";
import { Bone, LoadingNote } from "@/components/Skeleton";

// 전시 상세를 불러오는 동안: 포스터·제목·기간/장소 칸·소개 자리를 실제 화면과 같은 자리에 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>전시 정보를 불러오는 중</LoadingNote>
      <BackLink label="뒤로" />

      <div aria-hidden>
        {/* 포스터 칸(실제와 같은 회색 바탕 + 3:4 포스터 자리) */}
        <div className="mt-2 flex justify-center rounded-lg bg-fill p-4">
          {/* 회색 바탕 위라서 막대(bg-fill)보다 한 단계 진한 색으로 */}
          <div className="owl-bone aspect-[3/4] w-full max-w-[22rem] rounded-xs bg-border" />
        </div>

        <div className="mt-5">
          <Bone className="h-6 w-14 rounded-xs" />
          <Bone className="mt-2 h-8 w-3/4" />
          <Bone className="mt-2 h-5 w-1/3" />
        </div>

        <div className="mt-5 space-y-3 rounded-md border border-border-card bg-card p-4">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-4 w-1/2" />
          <Bone className="h-4 w-2/3" />
        </div>

        <div className="mt-8">
          <Bone className="h-6 w-24" />
          <Bone className="mt-3 h-4 w-full" />
          <Bone className="mt-2 h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
