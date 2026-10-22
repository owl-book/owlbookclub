import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/components/AdminLogin";
import { MeetingDetail } from "@/components/MeetingDetail";
import { isAdmin, isAdminEnabled } from "@/lib/admin";
import { getPendingMeeting } from "@/lib/review";

// 승인 대기 모임의 상세 화면 미리보기. 공개 화면과 같은 부품(MeetingDetail)으로 그린다.
export const metadata: Metadata = { title: "미리보기", robots: { index: false, follow: false } };

export default async function AdminReviewPreviewPage({ params }: PageProps<"/admin/review/[id]">) {
  await connection();
  if (!isAdminEnabled()) notFound();
  const { id } = await params;
  if (!(await isAdmin())) return <AdminLogin next="/admin/review" />;

  const m = await getPendingMeeting(Number(id));
  if (!m) notFound();

  // 찜·기록은 손님 기능이라 미리보기에서는 끈다
  const wishes = { enabled: false, user: null, meetingIds: new Set<number>(), storeIds: new Set<number>(), exhibitionIds: new Set<number>() };
  return <MeetingDetail m={m} now={new Date()} wishes={wishes} preview={{ backHref: "/admin/review" }} />;
}
