// 홈 화면 앱 아이콘(부엉이 얼굴). 그림 파일 대신 코드로 그려서, 크기마다 같은 모양의 PNG 를 만든다.
// ImageResponse 안에서는 Tailwind 토큰을 쓸 수 없어 디자인 시스템 v2.2 의 값을 그대로 옮겨 적는다.
const NAVY = "#27354f"; // --color-navy
const CREAM = "#f5ede0"; // --illustration-cream
const MOON = "#ffe082"; // --color-amber-moon
const AMBER = "#edb93a"; // --color-amber

// 귀깃이 솟은 부엉이 얼굴 윤곽(512 칸 기준)
const FACE = "M116 206 L148 108 L210 166 Q256 152 302 166 L364 108 L396 206 Q414 384 256 424 Q98 384 116 206 Z";

// 부엉이는 가운데 동그란 안전 영역(지름 80%) 안에만 그린다: 안드로이드가 아이콘을 원·물방울 모양으로 잘라도 안 잘리게
export function AppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <rect width="512" height="512" fill={NAVY} />
      <path d={FACE} fill={CREAM} />
      <circle cx="194" cy="258" r="52" fill={MOON} />
      <circle cx="318" cy="258" r="52" fill={MOON} />
      <circle cx="200" cy="262" r="22" fill={NAVY} />
      <circle cx="312" cy="262" r="22" fill={NAVY} />
      <path d="M234 306 L278 306 L256 342 Z" fill={AMBER} />
    </svg>
  );
}

// 알림 막대에 뜨는 작은 아이콘(안드로이드): 기기는 투명도만 보고 색을 입히므로, 흰색 한 가지에 눈은 구멍으로 뚫는다
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
