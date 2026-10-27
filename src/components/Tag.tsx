import { count } from "@/lib/format";

// 뱃지 규칙(모든 화면 공통). 모양은 모두 pill(radius-full, 99px)
// - 상태 뱃지(StatusBadge): 시간이 지나면 바뀌는 정보. 색을 채우고, 색과 함께 글자로도 뜻을 알 수 있게 한다
//   파랑 = 다가와요·지금 해요, 주황 = 신청할 수 없어요, 회색 = 끝났어요
// - 속성 뱃지(PlainTag): 처음부터 정해진 정보. 회색 테두리 한 가지
const PILL = "inline-block whitespace-nowrap rounded-full px-2 py-px text-l2";

const STATUS_TONE = {
  info: "bg-info-surface font-semibold text-info",
  warning: "bg-warning-surface font-semibold text-warning",
  neutral: "bg-fill font-semibold text-ink-2",
} as const;

export function StatusBadge({ tone, children, className = "" }: { tone: keyof typeof STATUS_TONE; children: React.ReactNode; className?: string }) {
  return <span className={`${PILL} ${STATUS_TONE[tone]} ${className}`}>{children}</span>;
}

export function PlainTag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`${PILL} border border-border-card font-medium text-ink-2 ${className}`}>{children}</span>;
}

// 장르 '기타'는 보는 사람에게 알려 주는 정보가 없어서 태그를 감춘다(카드·상세 화면 공통. DB 값과 첫 화면 필터는 그대로)
export function GenreTag({ genre }: { genre: string }) {
  if (genre === "기타") return null;
  return <PlainTag>{genre}</PlainTag>;
}

// 모임 상태: 겹치면 하나만(지난 모임 > 신청마감 > 진행 중). 묶음 모임은 일괄 신청이라 진행 중이면서 마감이면 '신청마감'만
export type MeetingStatus = "past" | "closed" | "ongoing";
const MEETING_STATUS: Record<MeetingStatus, { tone: keyof typeof STATUS_TONE; label: string }> = {
  past: { tone: "neutral", label: "지난 모임" },
  closed: { tone: "warning", label: "신청마감" },
  ongoing: { tone: "info", label: "진행 중" },
};

export function MeetingStatusBadge({ kind, className }: { kind: MeetingStatus; className?: string }) {
  const s = MEETING_STATUS[kind];
  return (
    <StatusBadge tone={s.tone} className={className}>
      {s.label}
    </StatusBadge>
  );
}

// 여러 회차 묶음 모임: 어느 카드든 '총 N회' 한 가지로(몇 번째 회차인지는 상세 화면 회차 목록에서 본다)
export function SeriesBadge({ total, className = "" }: { total: number; className?: string }) {
  return <PlainTag className={`fig ${className}`}>총 {count(total, "회")}</PlainTag>;
}
