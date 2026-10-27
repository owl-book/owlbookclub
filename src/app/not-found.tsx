import Link from "next/link";

// 모임·책방·전시가 아닌 엉뚱한 주소로 들어왔을 때. 모임 주소(/m/…)는 m/[id]/not-found.tsx 가 따로 맡는다
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-4xl" aria-hidden>🦉</p>
      <h1 className="mt-3 font-display text-h2 text-ink">찾으시는 페이지가 없어요</h1>
      <p className="mt-1 text-b2 text-ink-2">주소가 바뀌었거나 잘못 입력되었을 수 있습니다.</p>
      <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover">
        홈으로
      </Link>
    </div>
  );
}
