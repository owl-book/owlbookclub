import Link from "next/link";

// 없는 전시 주소(숨긴 전시 포함. 끝난 전시는 지난 전시로 계속 보이므로 여기 오지 않는다): 특정 전시 링크를 누르고 들어온 사람이라 '그 전시'를 못 찾았다고 알리고 전시 목록으로 보낸다
export default function ExhibitionNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-4xl" aria-hidden>🦉</p>
      <h1 className="mt-3 font-display text-h2 text-ink">전시를 찾을 수 없어요</h1>
      <p className="mt-1 text-b2 text-ink-2">책방 요청으로 내려갔거나 주소가 바뀌었을 수 있어요.</p>
      <Link href="/exhibitions" className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-white hover:bg-navy-hover">
        다른 전시 둘러보기
      </Link>
    </div>
  );
}
