import Link from "next/link";
import type { RegionChoice, Sido } from "@/lib/regions";

// 책방·전시 목록 위의 지역 칸(가로로 밀어 보는 칩). 지역이 하나뿐이면 고를 게 없어서 통째로 뺀다
export function RegionChips({
  choices,
  sido,
  gu,
  href,
}: {
  choices: RegionChoice[];
  sido: Sido | null;
  gu: string | null;
  href: (next: { sido: Sido | null; gu?: string | null }) => string;
}) {
  if (choices.length <= 1) return null;
  return (
    <nav aria-label="지역" className="-mx-4 mt-5 overflow-x-auto px-4">
      <ul className="flex gap-2">
        <li>
          <RegionChip href={href({ sido: null })} selected={!sido}>
            전체
          </RegionChip>
        </li>
        {choices.map((r) => (
          <li key={r.label}>
            <RegionChip href={href({ sido: r.sido, gu: r.gu })} selected={sido === r.sido && gu === r.gu}>
              {r.label}
            </RegionChip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RegionChip({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-xs border px-4 text-l1 ${
        selected ? "border-navy bg-navy text-page" : "border-border-card bg-card text-ink-2 hover:bg-sub"
      }`}
    >
      {children}
    </Link>
  );
}
