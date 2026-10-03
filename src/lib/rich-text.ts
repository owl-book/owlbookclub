// 책방이 적은 소개 글을 문단·점 목록·번호 목록으로 나눈다(HTML은 받지 않는다 → 화면에는 글자로만 그린다)
//   빈 줄        → 문단 나누기
//   '- ' '* ' '• ' 로 시작 → 점 목록
//   '1. ' '1) ' 로 시작    → 번호 목록(처음 번호부터 이어서 센다)
//   목록 항목 다음 줄을 띄어쓰기로 시작하면 같은 항목의 다음 줄로 본다

export type TextBlock =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[][] }
  | { type: "ol"; start: number; items: string[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseRichText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let cur: TextBlock | null = null;
  const close = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBER.exec(line);
    if (b) {
      if (cur?.type !== "ul") {
        close();
        cur = { type: "ul", items: [] };
      }
      cur.items.push([b[1]]);
    } else if (n) {
      if (cur?.type !== "ol") {
        close();
        cur = { type: "ol", start: Number(n[1]), items: [] };
      }
      cur.items.push([n[2]]);
    } else if ((cur?.type === "ul" || cur?.type === "ol") && /^\s/.test(line)) {
      cur.items[cur.items.length - 1].push(line.trim());
    } else {
      if (cur?.type !== "p") {
        close();
        cur = { type: "p", lines: [] };
      }
      cur.lines.push(line.trim());
    }
  }
  close();
  return blocks;
}

// 공유 미리보기·검색 결과용 한 줄 요약: 첫 덩어리(문단 또는 목록)만 목록 기호를 떼고 이어 붙여 max 글자에서 자른다
export function plainSummary(text: string, max = 80): string {
  const [first] = parseRichText(text);
  if (!first) return "";
  const flat = (first.type === "p" ? first.lines : first.items.flat())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// 화면(휴대폰 폭)에서 대략 몇 줄로 보일지 어림한다 → '더 보기'로 접을지 정할 때 쓴다
// 한 줄에 한글 약 22자, 문단·목록 사이 여백은 반 줄로 친다
export function estimateLines(text: string, charsPerLine = 22): number {
  const lines = (ls: string[]) => ls.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0);
  const blocks = parseRichText(text);
  const body = blocks.reduce((n, b) => n + (b.type === "p" ? lines(b.lines) : b.items.reduce((k, it) => k + lines(it), 0)), 0);
  return body + Math.max(0, blocks.length - 1) * 0.5;
}
