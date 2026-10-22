import Link from "next/link";
import { logoutAdmin } from "@/lib/admin-actions";

// 운영자 화면 맨 위 탭. 승인 대기·신고함·책 표지를 오가고, 탭마다 남은 할 일 수를 보여 준다.
// 나가기는 탭과 떨어진 오른쪽 위에 둬서 탭을 누르려다 잘못 누르지 않게 한다.
const TABS = [
  { key: "review", href: "/admin/review", label: "승인 대기" },
  { key: "reports", href: "/admin/reports", label: "신고함" },
  { key: "covers", href: "/admin/covers", label: "책 표지" },
] as const;

type Props = {
  current: (typeof TABS)[number]["key"];
  counts: Record<(typeof TABS)[number]["key"], number>;
};

export function AdminNav({ current, counts }: Props) {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-l1 font-semibold text-ink-2">운영자 화면</p>
        <form action={logoutAdmin}>
          <button type="submit" className="inline-flex min-h-11 items-center px-2 text-l2 text-ink-3 underline underline-offset-2 hover:text-navy">
            나가기
          </button>
        </form>
      </div>
      <nav aria-label="운영자 화면" className="border-b border-border">
        <ul className="flex gap-1">
          {TABS.map((t) => {
            const active = t.key === current;
            const count = counts[t.key];
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-t2 ${
                    active ? "border-navy text-ink" : "border-transparent text-ink-3 hover:text-navy"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      aria-label={`남은 일 ${count}개`}
                      className={`rounded-full px-1.5 text-l2 font-semibold ${active ? "bg-navy text-white" : "bg-fill text-ink-2"}`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
