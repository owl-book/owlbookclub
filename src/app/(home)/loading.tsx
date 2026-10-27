import { Suspense } from "react";
import { SearchModeSwitch } from "@/components/SearchModeSwitch";
import { Bone, LoadingNote, MeetingListSkeleton } from "@/components/Skeleton";

// 광고 슬라이더(HomeSlider)와 같은 크기(멈춤·넘김 버튼은 장 안에 얹혀 따로 줄이 없다).
// 슬라이더처럼 헤더 바로 밑(위 여백 pt-5 를 되돌림)에 붙고 양옆 끝까지 채운다
const intro = (
  <div className="-mx-4 -mt-5 mb-4">
    <Bone className="h-[181px] rounded-none!" />
  </div>
);
// 날짜 버튼·필터 버튼 한 줄, 달력, 모임 수
const controls = (
  <>
    <div className="flex gap-2">
      <Bone className="h-11 w-16 rounded-full" />
      <Bone className="h-11 w-20 rounded-full" />
      <Bone className="h-11 w-20 rounded-full" />
      <Bone className="ml-auto h-11 w-20 rounded-full" />
    </div>
    <Bone className="h-[124px] rounded-md" />
    <Bone className="h-3 w-32" />
  </>
);
// 검색 중: 날짜·필터 두 버튼과 모임 수
const searchingControls = (
  <>
    <div className="flex gap-2">
      <Bone className="h-11 flex-[3] rounded-sm" />
      <Bone className="h-11 flex-[2] rounded-sm" />
    </div>
    <Bone className="h-3 w-32" />
  </>
);

// 첫 화면을 불러오는 동안: 제목·소개 문장은 늘 같아서 실제 글자로 먼저 보여 주고,
// 검색칸·날짜 고르기·모임 카드 자리는 뼈대로 잡아 둔다.
// 검색 중이면 실제 화면처럼 제목·소개를 빼고 날짜·필터를 두 버튼으로 모아, 다 불러온 뒤 화면이 들썩이지 않게 한다.
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] pt-5">
      <LoadingNote>모임 목록을 불러오는 중</LoadingNote>
      <Suspense fallback={intro}>
        <SearchModeSwitch normal={intro} searching={null} />
      </Suspense>

      <div aria-hidden className="space-y-3">
        <div className="flex gap-2">
          <Bone className="h-11 flex-1" />
          <Bone className="h-11 w-16 rounded-sm" />
        </div>
        <Suspense fallback={controls}>
          <SearchModeSwitch normal={controls} searching={searchingControls} />
        </Suspense>
      </div>

      <div className="mt-4">
        <MeetingListSkeleton />
      </div>
    </div>
  );
}
