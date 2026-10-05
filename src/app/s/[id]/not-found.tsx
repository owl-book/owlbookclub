import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-4xl" aria-hidden>🦉</p>
      <h1 className="mt-3 font-display text-h2 text-ink">찾으시는 책방이 없어요</h1>
      <p className="mt-1 text-b2 text-ink-2">책방 요청으로 내려갔거나 주소가 바뀌었을 수 있습니다.</p>
      <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-white hover:bg-navy-hover">
        모임 둘러보기
      </Link>
    </div>
  );
}
