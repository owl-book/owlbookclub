import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 홈 화면 앱 아이콘: 크림 바탕 가운데에 책 읽는 부엉이 그림(public/owl-wink.png)을 놓는다.
// ImageResponse 안에서는 Tailwind 토큰을 쓸 수 없어 디자인 시스템 v2.2 의 값을 그대로 옮겨 적는다.
const CREAM = "#f5ede0"; // --illustration-cream
const OWL_RATIO = 239 / 319; // owl-wink.png 의 가로 ÷ 세로

let owlSrc: Promise<string> | undefined;

// 그림 파일을 한 번만 읽어 data URL 로 넘긴다(ImageResponse 는 파일 경로를 직접 못 읽는다)
export function loadOwlSrc() {
  owlSrc ??= readFile(join(process.cwd(), "public/owl-wink.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return owlSrc;
}

// scale: 부엉이 키가 아이콘 한 변에서 차지하는 비율.
// 아이폰·일반 아이콘은 0.8, 안드로이드가 원·물방울 모양으로 자르는 maskable 은 가운데 안전 영역(지름 80%) 안에 들도록 0.62
export function AppIcon({ size, src, scale = 0.8 }: { size: number; src: string; scale?: number }) {
  const h = Math.round(size * scale);
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: CREAM }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={Math.round(h * OWL_RATIO)} height={h} alt="" />
    </div>
  );
}

// 알림 막대에 뜨는 작은 아이콘(안드로이드): 기기는 투명도만 보고 색을 입히므로, 흰색 한 가지에 눈은 구멍으로 뚫는다
const FACE = "M116 206 L148 108 L210 166 Q256 152 302 166 L364 108 L396 206 Q414 384 256 424 Q98 384 116 206 Z";
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

export function BadgeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <path d={`${FACE} ${circle(194, 258, 52)} ${circle(318, 258, 52)}`} fill="#ffffff" fillRule="evenodd" />
      <circle cx="194" cy="258" r="20" fill="#ffffff" />
      <circle cx="318" cy="258" r="20" fill="#ffffff" />
    </svg>
  );
}
