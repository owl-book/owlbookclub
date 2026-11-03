import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExhibitionDetail } from "@/components/ExhibitionDetail";
import { KIND_LABEL, getExhibition } from "@/lib/exhibitions";
import { getWishContext } from "@/lib/me";
import { getStore } from "@/lib/stores";
import { formatDateStringWithDay } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/e/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await getExhibition(Number(id));
  if (!e) return { title: "전시를 찾을 수 없어요" };
  const description = `${e.store.name}(${e.store.region}) ${KIND_LABEL[e.kind]} · ${formatDateStringWithDay(e.startsOn)} ~ ${formatDateStringWithDay(e.endsOn)}`;
  return {
    title: e.title,
    description,
    openGraph: { title: `${e.title} | 부엉이들의 서재`, description, images: e.poster ? [e.poster.url] : undefined },
    alternates: { canonical: `/e/${e.id}` },
  };
}

export default async function ExhibitionPage({ params }: PageProps<"/e/[id]">) {
  const { id } = await params;
  const e = await getExhibition(Number(id));
  if (!e) notFound();

  const [store, wishes] = await Promise.all([getStore(e.store.id), getWishContext()]);
  return <ExhibitionDetail e={e} now={new Date()} store={store} wishes={wishes} />;
}
