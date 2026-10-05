import { BackLink } from "@/components/BackLink";
import { Bone, LoadingNote, MeetingListSkeleton } from "@/components/Skeleton";

// 책방 화면을 불러오는 동안: 남색 간판은 실제 색으로 먼저 띄워 '책방으로 넘어왔다'는 걸 바로 알 수 있게 하고,
// 간판 안의 글자와 아래 모임 카드만 뼈대로 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>책방 정보를 불러오는 중</LoadingNote>
      <BackLink label="뒤로" />

      <div aria-hidden>
        <div className="mt-1 rounded-lg bg-dk-card px-5 pb-5 pt-6">
          <DarkBone className="h-4 w-20" />
          <DarkBone className="mt-3 h-9 w-2/3" />
          <DarkBone className="mt-3 h-4 w-4/5" />
        </div>

        <div className="mt-4 space-y-3 rounded-md border border-border-card bg-card p-4">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-4 w-1/2" />
        </div>

        <div className="mt-8">
          <Bone className="h-5 w-28" />
          <div className="mt-2">
            <MeetingListSkeleton count={2} hideStore />
          </div>
        </div>
      </div>
    </div>
  );
}

// 남색 간판 위에서 쓰는 뼈대 막대(밝은 막대는 간판 위에서 너무 튀어서 한 단계 밝은 남색을 쓴다)
function DarkBone({ className }: { className: string }) {
  return <div className={`owl-bone rounded-xs bg-dk-sub ${className}`} />;
}
