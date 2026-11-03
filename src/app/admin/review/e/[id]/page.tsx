import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { ExhibitionDetail } from "@/components/ExhibitionDetail";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getPendingExhibition } from "@/lib/review";
import { getStore } from "@/lib/stores";

// 승인 대기 전시의 상세 화면 미리보기. 공개 화면과 같은 부품(ExhibitionDetail)으로 그린다.
export const metadata: Metadata = { title: "미리보기", robots: { index: false, follow: false } };

export default async function AdminReviewExhibitionPreviewPage({ params }: PageProps<"/admin/review/e/[id]">) {
  await connection();
  if (!isAdminEnabled()) notFound();
  const { id } = await params;
  if (!(await isAdmin())) return <AdminLogin next="/admin/review" />;

  const e = await getPendingExhibition(Number(id));
  if (!e) notFound();

  // 찜은 손님 기능이라 미리보기에서는 끈다
  const store = await getStore(e.store.id);
  const wishes = { enabled: false, user: null, exhibitionIds: new Set<number>() };
  return <ExhibitionDetail e={e} now={new Date()} store={store} wishes={wishes} preview={{ backHref: `/admin/review#e-${e.id}` }} />;
}
