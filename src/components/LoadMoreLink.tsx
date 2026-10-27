"use client";

import Link, { useLinkStatus } from "next/link";

// 목록 아래 '더 보기' 버튼. 주소에 몇 번째까지 펼쳤는지 남겨서, 뒤로 와도 보던 데까지 그대로 보인다.
// 누른 뒤 화면이 맨 위로 튀지 않게 제자리에 둔다(scroll={false}). 새 모임은 MeetingList가 펼치며 보여 준다
export function LoadMoreLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-sm border border-border-card bg-page px-4 text-l1 font-medium text-ink hover:bg-sub active:bg-fill"
    >
      <Label />
    </Link>
  );
}

// 불러오는 동안 글자를 옅게 바꿔 눌린 걸 알려 준다
function Label() {
  const { pending } = useLinkStatus();
  return <span className={`transition-colors ${pending ? "text-ink-3" : ""}`}>{pending ? "불러오는 중…" : "더 보기"}</span>;
}
