// 풋바 '의견·요청 보내기'의 종류와 보기 (문의 화면·관리자 신고함·서버 검사가 함께 쓴다)
// DB inquiries.category / topic 과 같은 값(supabase/migrations/0016_inquiries.sql). 한쪽을 바꾸면 다른 쪽도 바꿀 것.
//
// 보기마다 어떤 칸을 보여 줄지 정한다:
//   store   사이트에 있는 책방 고르기   name  아직 없는 책방 이름 적기(+주소 칸)
//   message 'required' | 'optional'    contact 'required' | 'optional' | 'none'

export type Need = "required" | "optional" | "none";

export type InquiryTopic = {
  key: string;
  label: string;
  store: "pick" | "name" | "none";
  message: Exclude<Need, "none">;
  contact: Need;
  placeholder: string;
  hint?: string; // 보기를 고르면 바로 아래에 보여 줄 안내
};

export type InquiryCategory = { key: string; label: string; topicLegend?: string; topics: InquiryTopic[] };

export const INQUIRY_CATEGORIES = [
  {
    key: "info",
    label: "정보가 달라요",
    topicLegend: "어떤 정보인가요?",
    topics: [
      {
        key: "store",
        label: "책방 정보",
        store: "pick",
        message: "required",
        contact: "optional", // 운영하는 책방을 고치려는 분이 답장을 받을 수 있게
        placeholder: "예: 운영시간이 화~일 12시~8시로 바뀌었어요",
      },
      {
        key: "meeting",
        label: "모임 정보",
        store: "pick",
        message: "required",
        contact: "none",
        placeholder: "예: ‘10월 북토크’ 모임이 15일에서 22일로 바뀌었어요",
        hint: "모임 화면 아래 ‘알려주기’로 보내시면 어느 모임인지 바로 알 수 있어 더 빨리 고쳐져요.",
      },
      {
        key: "book",
        label: "책 정보",
        store: "none",
        message: "required",
        contact: "none",
        placeholder: "예: ‘○○ 모임’의 책 표지가 다른 책이에요",
      },
    ],
  },
  {
    key: "suggest",
    label: "새 책방·모임을 알려드려요",
    topics: [
      {
        key: "new",
        label: "새 책방·모임",
        store: "name",
        message: "optional",
        contact: "optional",
        placeholder: "예: 매달 둘째 주 토요일에 독서모임을 열어요",
      },
    ],
  },
  {
    key: "site",
    label: "그 밖의 문의",
    topicLegend: "어떤 문의인가요?",
    topics: [
      { key: "bug", label: "화면이 이상하거나 안 돼요", store: "none", message: "required", contact: "optional", placeholder: "예: 아이폰에서 날짜 버튼이 눌리지 않아요" },
      {
        key: "account",
        label: "로그인·계정 문제",
        store: "none",
        message: "required",
        contact: "optional",
        placeholder: "예: 카카오로 로그인하면 첫 화면으로 돌아가요",
        hint: "회원 탈퇴는 마이페이지 > 내 정보에서 바로 할 수 있어요.",
      },
      { key: "idea", label: "이런 기능이 있으면 좋겠어요", store: "none", message: "required", contact: "optional", placeholder: "예: 요일별로 모아 보고 싶어요" },
      {
        key: "pause",
        label: "게시를 잠시 멈추거나 빼고 싶어요",
        store: "pick",
        message: "optional",
        contact: "required",
        placeholder: "예: 11월 한 달만 멈춰 주세요",
        hint: "책방 운영자이신지 확인한 뒤 반영해요. 확인은 책방 공식 인스타그램이나 대표번호로 연락드려요.",
      },
      { key: "other", label: "그 외", store: "none", message: "required", contact: "optional", placeholder: "자유롭게 적어 주세요" },
    ],
  },
] as const satisfies readonly InquiryCategory[];

export const INQUIRY_LIMITS = { storeName: 100, link: 300, message: 1000, contact: 100 };

export function findInquiryTopic(category: unknown, topic: unknown): { category: InquiryCategory; topic: InquiryTopic } | null {
  const c = (INQUIRY_CATEGORIES as readonly InquiryCategory[]).find((x) => x.key === category);
  const t = c?.topics.find((x) => x.key === topic);
  return c && t ? { category: c, topic: t } : null;
}

// 신고함에 보여 줄 이름: '그 밖의 문의 · 게시를 잠시 멈추거나 빼고 싶어요'
export function inquiryLabel(category: string, topic: string): string {
  const found = findInquiryTopic(category, topic);
  if (!found) return `${category} · ${topic}`;
  return found.category.topics.length > 1 ? `${found.category.label} · ${found.topic.label}` : found.category.label;
}

export type InquiryInput = {
  category: string;
  topic: string;
  storeId?: number | null;
  storeName?: string;
  link?: string;
  message?: string;
  contact?: string;
  website?: string; // 사람 눈에는 안 보이는 칸
};

export type InquiryResult = { ok: true } | { ok: false; reason: "too_many" | "invalid" | "failed" };
