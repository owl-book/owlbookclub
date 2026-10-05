import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ArrowLeftIcon";
import { Bone, LoadingNote } from "@/components/Skeleton";

// 탈퇴 화면을 불러오는 동안(내 정보 뼈대가 대신 뜨지 않도록 따로 둔다)
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-2">
      <LoadingNote>불러오는 중</LoadingNote>
      <Link href="/me/account" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-l1 text-ink-2 hover:text-navy">
        <ArrowLeftIcon />
        내 정보
      </Link>
      <h1 className="mt-1 font-display text-h2 text-ink">회원 탈퇴</h1>
      <div aria-hidden className="mt-5">
        <Bone className="h-24 rounded-md" />
        <Bone className="mt-6 h-12 rounded-sm" />
      </div>
    </div>
  );
}
