import type { Metadata } from "next";
import Link from "next/link";
import { ExhibitionList } from "@/components/ExhibitionCard";
import { RegionChips } from "@/components/RegionChips";
import { groupExhibitions, listExhibitions, type Exhibition } from "@/lib/exhibitions";
import { getWishContext, type WishContext } from "@/lib/me";
import { isGuOf, isSido, matchesRegion, regionChoicesOf, type Sido } from "@/lib/regions";

export const metadata: Metadata = {
  title: "책방 전시 소식",
  description: "동네책방에서 열리는 그림·사진 전시, 그림책 원화전, 팝업 소식을 모아 봐요. 작품은 책방에 가서 직접 만나요.",
  alternates: { canonical: "/exhibitions" },
};

// 책방 전시 모아보기: 지금 하는 전시(끝나는 날 가까운 순) → 곧 열리는 전시(시작일 순) → 지난 전시(접어 둠).
// 지역 칸은 책방 모아보기와 같은 시·도 + 구·시·군 단위로, 전시가 있는 지역만 보여 준다
export default async function ExhibitionsPage({ searchParams }: PageProps<"/exhibitions">) {
  const sp = await searchParams;
  const sido = isSido(sp.sido) ? sp.sido : null;
  const gu = sido && isGuOf(sido, sp.gu) ? sp.gu : null;

  const now = new Date();
  const [all, wishes] = await Promise.all([listExhibitions(), getWishContext()]);
  const regions = regionChoicesOf(all.map((e) => e.store.region));
  const { now: showing, soon, past } = groupExhibitions(
    all.filter((e) => matchesRegion(e.store.region, sido, gu)),
    now,
  );

  const href = (next: { sido: Sido | null; gu?: string | null }) => {
    const p = new URLSearchParams();
    if (next.sido) p.set("sido", next.sido);
    if (next.sido && next.gu) p.set("gu", next.gu);
    const qs = p.toString();
    return qs ? `/exhibitions?${qs}` : "/exhibitions";
  };

  return (
    <div className="pt-5">
      <section>
        <h1 className="font-display text-h1 text-ink">책방 전시 소식</h1>
        <p className="mt-2 text-b2 text-ink-2">동네책방에서 열리는 전시와 팝업을 모았어요. 작품은 책방에 가서 직접 만나 보세요.</p>
      </section>

      <RegionChips choices={regions} sido={sido} gu={gu} href={href} />

      <Section id="ex-now" title="지금 하는 전시" list={showing} now={now} wishes={wishes} className="mt-6">
        <Empty>{sido ? "이 지역에는 지금 진행 중인 전시가 없어요" : "지금 진행 중인 전시가 없어요"}</Empty>
      </Section>

      {soon.length > 0 && <Section id="ex-soon" title="곧 열리는 전시" list={soon} now={now} wishes={wishes} className="mt-10" />}

      {past.length > 0 && (
        <details className="group mt-10">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-l1 text-ink-2 hover:text-navy [&::-webkit-details-marker]:hidden">
            지난 전시 {past.length}개 <span className="group-open:hidden">보기</span>
            <span className="hidden group-open:inline">접기</span>
          </summary>
          <ExhibitionList list={past} now={now} wishes={wishes} className="mt-2" />
        </details>
      )}

      <p className="mt-8 text-l2 font-normal text-ink-3">
        빠진 책방 전시가 있으면{" "}
        <Link href="/contact?as=suggest" className="-my-3 inline-flex min-h-11 items-center text-navy underline underline-offset-2 hover:text-navy-hover">
          알려주기
        </Link>
      </p>
    </div>
  );
}

function Section({
  id,
  title,
  list,
  now,
  wishes,
  className,
  children,
}: {
  id: string;
  title: string;
  list: Exhibition[];
  now: Date;
  wishes: WishContext;
  className: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="border-b border-border pb-2 text-t2 text-ink">
        {title}
        {list.length > 0 && <span className="ml-1.5 text-l1 text-ink-3">{list.length}개</span>}
      </h2>
      {list.length > 0 ? <ExhibitionList list={list} now={now} wishes={wishes} className="mt-3" /> : <div className="mt-3">{children}</div>}
    </section>
  );
}

// 빈 화면: 지금 상황(제목) + 다음에 누를 곳 하나. 찜은 아직 전시 소식을 모아 주지 않아서 찜을 권하는 설명은 넣지 않는다
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border-card bg-sub px-4 py-6 text-center">
      <p className="text-t2 text-ink">{children}</p>
      <Link
        href="/stores"
        className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-border-strong bg-card px-4 text-l1 font-semibold text-navy hover:bg-sub"
      >
        동네책방 둘러보기
      </Link>
    </div>
  );
}
