// 디자인 시스템 v2.2: 태그는 radius-xs(4px), 중립 표면. 장르별 색은 시스템에 없어 장르 태그만 채운 면으로 구분한다.

export function GenreTag({ genre }: { genre: string }) {
  return <span className="rounded-xs bg-fill px-1.5 py-0.5 text-l2 font-semibold text-ink-2">{genre}</span>;
}

export function PlainTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-xs border border-border px-1.5 py-0.5 text-l2 text-ink-3">{children}</span>;
}

// 신청 마감은 상태 알림이라 시맨틱 경고색, 지난 모임은 중립색
export function StatusBadge({ kind }: { kind: "closed" | "past" }) {
  return kind === "closed" ? (
    <span className="rounded-xs border border-warning-border bg-warning-surface px-1.5 py-0.5 text-l2 font-semibold text-warning">
      신청 마감
    </span>
  ) : (
    <span className="rounded-xs bg-fill px-1.5 py-0.5 text-l2 font-semibold text-ink-3">지난 모임</span>
  );
}
