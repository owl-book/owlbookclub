import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";
import { Bone, LoadingNote } from "@/components/Skeleton";

// 모임 기록 화면을 불러오는 동안: 모임 요약 칸과 만족도·문장·메모 칸 자리를 잡아 둔다
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>모임 기록을 불러오는 중</LoadingNote>
      <Link href="/me?tab=mine" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        마이페이지
      </Link>
      <div aria-hidden>
        <Bone className="mt-2 h-8 w-2/5" />
        <div className="mt-4 rounded-md border border-border-card bg-sub p-4">
          <Bone className="h-3 w-1/2" />
          <Bone className="mt-2 h-5 w-4/5" />
          <Bone className="mt-1.5 h-4 w-2/5" />
        </div>
        <Bone className="mt-4 h-3 w-full" />
        <div className="mt-5 space-y-6">
          <div>
            <Bone className="h-4 w-14" />
            <Bone className="mt-2 h-11 w-56" />
          </div>
          <div>
            <Bone className="h-4 w-24" />
            <Bone className="mt-2 h-20" />
          </div>
          <div>
            <Bone className="h-4 w-16" />
            <Bone className="mt-2 h-44" />
          </div>
        </div>
      </div>
    </div>
  );
}
