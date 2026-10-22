import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/MeetingDetail";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth";
import { getPlan, getRecord, getWishContext } from "@/lib/me";
import { getMeeting, isPast } from "@/lib/meetings";
import { plainSummary } from "@/lib/rich-text";
import { meetingWhen } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = await getMeeting(Number(id));
  if (!m) return { title: "모임을 찾을 수 없어요" };
  // 공유 미리보기 설명: 모임 소개가 있으면 앞부분을 맨 앞에 둔다
  const description = `${m.description ? `${plainSummary(m.description)} · ` : ""}${meetingWhen(m)} · ${m.store.name}(${m.store.region})${m.bookTitle ? ` · 『${m.bookTitle}』${m.bookAuthor ? ` ${m.bookAuthor}` : ""}` : ""}`;
  return {
    title: `${m.title} | ${m.store.name}`,
    description,
    openGraph: { title: `${m.title} | ${m.store.name}`, description },
    alternates: { canonical: `/m/${m.id}` },
  };
}

export default async function MeetingPage({ params, searchParams }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMeeting(Number(id));
  if (!m) notFound();

  const now = new Date();
  const past = isPast(m, now);
  // 찜·기록·내 모임은 서로 기다릴 필요가 없어 한꺼번에 묻는다(로그인 확인은 DB를 거치지 않아 바로 끝난다)
  const user = isAuthEnabled() ? await getCurrentUser() : null;
  const [wishes, record, plan] = await Promise.all([
    getWishContext(),
    past && user ? getRecord(user.id, m.id) : null,
    // 내 모임(책방에서 신청했다고 표시했는지). 다가오는 모임에서만 쓴다
    !past && user ? getPlan(user.id, m.id) : null,
  ]);

  return <MeetingDetail m={m} now={now} wishes={wishes} record={record} plan={plan} plannedNotice={sp.planned === "1"} />;
}
