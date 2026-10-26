// 앱 아이콘(부엉이 얼굴)을 화면 안에 작게 그릴 때. 모양은 src/lib/app-icon.tsx(홈 화면 아이콘 PNG)와 같다
export function OwlMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <rect width="512" height="512" className="fill-navy" />
      <path d="M116 206 L148 108 L210 166 Q256 152 302 166 L364 108 L396 206 Q414 384 256 424 Q98 384 116 206 Z" fill="var(--illustration-cream)" />
      <circle cx="194" cy="258" r="52" className="fill-amber-moon" />
      <circle cx="318" cy="258" r="52" className="fill-amber-moon" />
      <circle cx="200" cy="262" r="22" className="fill-navy" />
      <circle cx="312" cy="262" r="22" className="fill-navy" />
      <path d="M234 306 L278 306 L256 342 Z" className="fill-amber" />
    </svg>
  );
}
