import Link from "next/link";
import { count } from "@/lib/format";

// 목록 아래 '더 보기' 버튼. 주소에 몇 번째까지 펼쳤는지 남겨서, 뒤로 와도 보던 데까지 그대로 보인다.
// 누른 뒤 화면이 맨 위로 튀지 않게 제자리에 둔다(scroll={false})
export function LoadMoreLink({ href, remaining }: { href: string; remaining: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-sm border border-border-card bg-page px-4 text-l1 font-medium text-ink hover:bg-sub active:bg-fill"
    >
      더 보기 <span className="ml-1 font-normal text-ink-2">(남은 {count(remaining, "개")})</span>
    </Link>
  );
}
