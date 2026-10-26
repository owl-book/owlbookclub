import { Fragment, createElement, type ReactNode } from "react";

// 화면에 보이는 글 표기를 한 곳에서 만든다: 숫자와 단위는 붙이고, 구분자는 ' · '(양쪽 띄어쓰기), 기간은 ' ~ '

// 1개, 21개, 2/4회 처럼 숫자와 단위를 붙여 쓴다
export function count(n: number, unit: string): string {
  return `${n}${unit}`;
}

// 비어 있는 항목은 건너뛰고 ' · '로 잇는다. 글자뿐 아니라 링크 같은 화면 조각도 받는다
export function joinDot(...parts: ReactNode[]): ReactNode[] {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return items.flatMap((p, i) => (i === 0 ? [createElement(Fragment, { key: i }, p)] : [" · ", createElement(Fragment, { key: i }, p)]));
}

// 글자만 이을 때(요약줄 등)
export function joinDotText(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(" · ");
}

// 기간: '10월 28일 ~ 11월 4일'
export function dateRange(from: string, to: string): string {
  return `${from} ~ ${to}`;
}

// 태그: '#문학 #글쓰기', 태그 사이는 띄어쓰기 한 번
export function hashTags(tags: (string | null | undefined)[]): string {
  return tags
    .filter((t): t is string => Boolean(t))
    .map((t) => `#${t}`)
    .join(" ");
}
