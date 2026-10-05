import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";
import { Bone, LoadingNote } from "@/components/Skeleton";

// 내 정보를 불러오는 동안(마이페이지 뼈대가 대신 뜨지 않도록 이 화면 것을 따로 둔다)
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>내 정보를 불러오는 중</LoadingNote>
      <Link href="/me" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        마이페이지
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">내 정보</h1>
      <div aria-hidden className="mt-6">
        <Bone className="h-5 w-24" />
        <Bone className="mt-3 h-11" />
        <Bone className="mt-1.5 h-3 w-3/4" />
        <Bone className="mt-3 h-12 rounded-sm" />
      </div>
    </div>
  );
}
