import Link from "next/link";

export default function MeetingNotFound() {
  return (
    <div className="py-16 text-center">
      <img src="/owl-reading.png" alt="" width={120} height={174} className="mx-auto" />
      <h1 className="mt-3 font-display text-h2 text-ink">찾으시는 모임이 없어요</h1>
      <p className="mt-1 text-b2 text-ink-2">책방 요청으로 내려갔거나 주소가 바뀌었을 수 있습니다.</p>
      <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover">
        다른 모임 둘러보기
      </Link>
    </div>
  );
}
