import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { ContactForm } from "@/components/ContactForm";
import { INQUIRY_CATEGORIES } from "@/lib/inquiry-kinds";
import { listStoreOptions } from "@/lib/stores";

export const metadata: Metadata = {
  title: "의견·요청 보내기",
  description: "정보 오류, 새 책방 제보, 게시 문의, 사이트 이용 의견을 보내 주세요.",
};

// 풋바 '의견·요청 보내기'. 책방 화면의 '알려주기'는 ?store=책방번호 로 들어와 책방을 미리 골라 둔다(?as=종류 로 종류도 미리 고를 수 있음)
export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const sp = await searchParams;
  const as = typeof sp.as === "string" ? sp.as : null;
  const initialCategory = INQUIRY_CATEGORIES.find((c) => c.key === as)?.key ?? null;
  const stores = await listStoreOptions();
  const storeParam = Number(typeof sp.store === "string" ? sp.store : NaN);
  const initialStoreId = stores.some((s) => s.id === storeParam) ? storeParam : null;

  return (
    <div className="pt-2">
      <BackLink label="뒤로" />
      {/* 제목 글꼴(아네모네)에는 가운뎃점이 없어 점만 본문 글꼴로 */}
      <h1 className="mt-3 font-display text-h2 text-ink">
        의견<span className="font-sans">·</span>요청 보내기
      </h1>
      <p className="mt-2 text-b2 text-ink-2">운영자가 직접 읽고 확인해요. 로그인하지 않아도 보낼 수 있어요.</p>
      <ContactForm stores={stores} initialCategory={initialCategory} initialStoreId={initialStoreId} />
    </div>
  );
}
