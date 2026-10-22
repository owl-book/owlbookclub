// 제목 글꼴(Cafe24 아네모네)에는 가운뎃점(·)이 없어 빈칸으로 보인다. 제목에 섞인 가운뎃점만 본문 글꼴로 바꿔 그린다
export function DisplayText({ children }: { children: string }) {
  const parts = children.split("·");
  if (parts.length === 1) return children;
  return parts.map((p, i) => (
    <span key={i}>
      {i > 0 && <span className="font-sans">·</span>}
      {p}
    </span>
  ));
}
