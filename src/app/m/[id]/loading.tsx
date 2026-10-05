import { BackLink } from "@/components/BackLink";
import { Bone, LoadingNote } from "@/components/Skeleton";
import { StickyActionBar } from "@/components/StickyActionBar";

// 모임 상세를 불러오는 동안: '모임 목록' 버튼은 바로 누를 수 있게 실제로 두고,
// 정보 칸의 항목 이름(일시·책방·장소·참가비)도 늘 같아서 글자로 먼저 보여 준다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>모임 정보를 불러오는 중</LoadingNote>
      <div className="flex min-h-11 items-center">
        <BackLink />
      </div>

      <div aria-hidden>
        <div className="mt-1 flex gap-1.5">
          <Bone className="h-6 w-12" />
          <Bone className="h-6 w-14" />
          <Bone className="h-6 w-10" />
        </div>
        <Bone className="mt-4 h-8 w-4/5" />
        <Bone className="mt-3 h-5 w-1/2" />

        <dl className="mt-5 space-y-3 rounded-md border border-border-card bg-card p-4 text-b2">
          {["일시", "책방", "장소", "참가비"].map((label) => (
            <div key={label} className="flex items-center gap-3">
              <dt className="w-14 shrink-0 text-ink-3">{label}</dt>
              <dd className="flex-1">
                <Bone className={`h-4 ${label === "장소" ? "w-4/5" : "w-1/2"}`} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 space-y-2">
          <Bone className="h-5 w-20" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-2/3" />
        </div>
      </div>

      <StickyActionBar>
        <Bone className="size-12 rounded-sm" />
        <Bone className="h-12 flex-1 rounded-sm" />
      </StickyActionBar>
    </div>
  );
}
