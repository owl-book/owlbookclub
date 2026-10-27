import type { Metadata } from "next";
import Link from "next/link";
import { RegionChips } from "@/components/RegionChips";
import { StatusBadge } from "@/components/Tag";
import { getStoreIdsShowingNow } from "@/lib/exhibitions";
import { isGuOf, isSido, matchesRegion, regionChoicesOf, type Sido } from "@/lib/regions";
import { listStoreSummaries, type StoreSummary } from "@/lib/stores";

export const metadata: Metadata = {
  title: "동네책방 모아보기",
  description: "독서모임이 올라온 동네책방을 지역별로 모아 보고, 책방마다 지금 신청할 수 있는 모임을 확인해요.",
  alternates: { canonical: "/stores" },
};

const SORTS = [
  { key: "new", label: "최신 등록순" },
  { key: "name", label: "가나다순" },
  { key: "old", label: "오래된 등록순" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

// 책방 모아보기: 모임이 한 번이라도 올라온 책방을 빠짐없이 보여 준다(모집 중인 모임이 0개여도).
// 기본 순서는 최신 등록순: 새로 들어온 책방을 알리려고. '곧 열리는 모임 순'은 매일 모임을 여는 책방이 늘 위에 와서 쓰지 않는다.
// 지역 칸은 모임 필터와 같은 시·도 + 구·시·군 단위로, 책방이 있는 지역만 보여 준다
export default async function StoresPage({ searchParams }: PageProps<"/stores">) {
  const sp = await searchParams;
  const sort: SortKey = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortKey) : "new";
  const sido = isSido(sp.sido) ? sp.sido : null;
  const gu = sido && isGuOf(sido, sp.gu) ? sp.gu : null;

  const [all, showing] = await Promise.all([listStoreSummaries(), getStoreIdsShowingNow()]);
  const regions = regionChoicesOf(all.map((s) => s.region));
  const stores = sortStores(
    all.filter((s) => matchesRegion(s.region, sido, gu)),
    sort,
  );

  const href = (next: { sido?: Sido | null; gu?: string | null; sort?: SortKey }) => {
    const p = new URLSearchParams();
    const nSido = next.sido !== undefined ? next.sido : sido;
    const nGu = next.sido !== undefined ? (next.gu ?? null) : gu;
    const nSort = next.sort ?? sort;
    if (nSido) p.set("sido", nSido);
    if (nSido && nGu) p.set("gu", nGu);
    if (nSort !== "new") p.set("sort", nSort);
    const qs = p.toString();
    return qs ? `/stores?${qs}` : "/stores";
  };

  return (
    <div className="pt-5">
      <section>
        <h1 className="font-display text-h1 text-ink">동네책방 모아보기</h1>
        <p className="mt-2 text-b2 text-ink-2">독서모임이 올라온 책방을 모두 모아 뒀어요. 책방을 눌러 어떤 모임을 여는지 둘러보세요.</p>
      </section>

      <RegionChips choices={regions} sido={sido} gu={gu} href={href} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 border-b border-border pb-1">
        <p className="text-l1 text-ink-2" aria-live="polite">
          책방 <span className="font-semibold text-ink">{stores.length}</span>곳
        </p>
        <nav aria-label="정렬" className="-mr-1 flex">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={href({ sort: s.key })}
              scroll={false}
              aria-current={sort === s.key ? "true" : undefined}
              className={`inline-flex min-h-11 items-center px-1 text-l1 ${sort === s.key ? "font-semibold text-navy underline decoration-2 underline-offset-4" : "text-ink-3 hover:text-navy"}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {stores.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {stores.map((s) => (
            <li key={s.id}>
              <StoreCard store={s} showing={showing.has(s.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
          <p className="text-t2 text-ink">{sido ? "이 지역에는 아직 올라온 책방이 없어요" : "아직 올라온 책방이 없어요"}</p>
        </div>
      )}

      <p className="mt-8 text-l2 font-normal text-ink-3">
        빠진 동네책방이 있으면{" "}
        <Link href="/contact?as=suggest" className="-my-3 inline-flex min-h-11 items-center text-navy underline underline-offset-2 hover:text-navy-hover">
          알려주기
        </Link>
      </p>
    </div>
  );
}

// showing: 오늘 이 책방에서 전시를 하고 있으면 지역 옆에 '전시 중'을 붙인다
function StoreCard({ store: s, showing }: { store: StoreSummary; showing: boolean }) {
  return (
    <Link
      href={`/s/${s.id}`}
      className="block rounded-md border border-border-card bg-card p-4 transition hover:border-border-strong active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-l1 text-ink-2">
        {s.region}
        {showing && <StatusBadge tone="info">전시 중</StatusBadge>}
      </p>
      <h2 className="mt-0.5 font-display text-t1 text-ink">{s.name}</h2>
      {s.intro && <p className="mt-1.5 line-clamp-2 break-keep text-b2 text-ink-2">{s.intro}</p>}
      {s.openCount > 0 ? (
        <p className="mt-3 text-l1 font-semibold text-navy">신청할 수 있는 모임 {s.openCount}개</p>
      ) : (
        <p className="mt-3 text-l1 text-ink-3">지금 신청할 수 있는 모임은 없어요</p>
      )}
    </Link>
  );
}

function sortStores(stores: StoreSummary[], sort: SortKey): StoreSummary[] {
  const byName = (a: StoreSummary, b: StoreSummary) => a.name.localeCompare(b.name, "ko");
  const byDate = (a: StoreSummary, b: StoreSummary) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id;
  return [...stores].sort(sort === "name" ? byName : sort === "old" ? byDate : (a, b) => byDate(b, a));
}
