// 앱 아이콘을 화면 안에 작게 그릴 때. 모양은 src/lib/app-icon.tsx(홈 화면 아이콘 PNG)와 같다
export function OwlMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`flex items-center justify-center bg-cream ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/owl-wink.png" alt="" className="h-4/5 w-auto" />
    </span>
  );
}
