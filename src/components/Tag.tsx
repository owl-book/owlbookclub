import { count } from "@/lib/format";

// 디자인 시스템 v2.2: 태그는 radius-xs(4px), 중립 표면. 장르별 색은 시스템에 없어 장르 태그만 채운 면으로 구분한다.

// 장르 '기타'는 보는 사람에게 알려 주는 정보가 없어서 태그를 감춘다(카드·상세 화면 공통. DB 값과 첫 화면 필터는 그대로)
export function GenreTag({ genre }: { genre: string }) {
  if (genre === "기타") return null;
  return <span className="rounded-xs bg-fill px-1.5 py-0.5 text-l2 font-semibold text-ink-2">{genre}</span>;
}

export function PlainTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-xs border border-border px-1.5 py-0.5 text-l2 text-ink-3">{children}</span>;
}

// 신청 마감은 상태 알림이라 시맨틱 경고색, 지난 모임은 중립색
export function StatusBadge({ kind }: { kind: "closed" | "past" }) {
  return kind === "closed" ? (
    <span className="whitespace-nowrap rounded-xs bg-warning-surface px-1.5 py-0.5 text-l2 font-semibold text-warning">
      신청 마감
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-xs bg-fill px-1.5 py-0.5 text-l2 font-semibold text-ink-3">지난 모임</span>
  );
}

// 여러 회차 묶음 모임: 목록에서 한 장으로 접은 카드는 'N회 묶음'(이미 시작했으면 '진행 중 2/4회'), 회차별 카드는 '2/4회'
export function SeriesBadge({ index, total, collapsed }: { index: number; total: number; collapsed: boolean }) {
  const text = !collapsed ? `${index}/${count(total, "회")}` : index > 1 ? `진행 중 ${index}/${count(total, "회")}` : `${count(total, "회")} 묶음`;
  return <span className="fig whitespace-nowrap rounded-xs bg-info-surface px-1.5 py-0.5 text-l2 font-semibold text-info">{text}</span>;
}
