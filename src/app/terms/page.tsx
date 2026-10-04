import type { Metadata } from "next";

export const metadata: Metadata = { title: "이용약관" };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "(운영자 이메일)";

export default function TermsPage() {
  return (
    <article className="space-y-5 pt-6 text-b2 text-ink-2 [&_h2]:mb-1.5 [&_h2]:text-t2 [&_h2]:text-ink">
      <h1 className="font-display text-h2 text-ink">이용약관</h1>
      <p className="text-ink-3">시행일: 2026년 10월 1일</p>

      <section>
        <h2>1. 서비스 내용</h2>
        <p>부엉이서재는 동네책방이 공개한 독서모임 정보를 모아 보여주고, 각 책방의 원 게시물·신청 페이지로 연결하는 정보 안내 서비스입니다. 모임 신청·결제·환불은 서비스가 아닌 각 책방이 진행합니다.</p>
      </section>

      <section>
        <h2>2. 정보의 정확성</h2>
        <p>서비스는 모임 정보를 주기적으로 확인하지만, 일정·장소·참가비·마감 여부는 바뀔 수 있습니다. 정확한 내용은 책방 신청 페이지를 기준으로 하며, 각 모임에 마지막 확인일을 표시합니다. 잘못된 정보는 모임 화면의 &lsquo;알려주기&rsquo;로 알려주시면 확인 후 고칩니다.</p>
      </section>

      <section>
        <h2>3. 책방의 게재 삭제·수정 요청</h2>
        <p>책방이 게재 삭제나 수정을 요청하면 즉시 반영하고, 삭제를 요청한 책방은 이후 다시 게재하지 않습니다.</p>
      </section>

      <section>
        <h2>4. 책임의 한계</h2>
        <p>서비스는 책방과 이용자 사이의 모임 신청·참여·결제에 당사자로 참여하지 않으며, 이 과정에서 생긴 분쟁은 해당 책방의 정책을 따릅니다. 다만 서비스의 고의 또는 중대한 과실로 인한 손해는 관련 법령에 따릅니다.</p>
      </section>

      <section>
        <h2>5. 문의</h2>
        <p>{contact}</p>
      </section>
    </article>
  );
}
