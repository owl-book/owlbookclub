import type { ReactNode } from "react";
import { OwlMark } from "@/components/OwlMark";

// 홈 화면에 추가하는 방법. 아이폰은 이걸 해야만 알림을 받을 수 있고, 안드로이드는 앱처럼 바로 열 수 있게 된다.
// 실제로 순서대로 누르는 단계라 번호를 붙인다. 버튼 모양은 휴대폰에 보이는 아이콘을 그대로 그려 찾기 쉽게 한다.
export function InstallGuide({ platform }: { platform: "ios" | "android" }) {
  const steps: { icon: ReactNode; text: ReactNode }[] =
    platform === "ios"
      ? [
          { icon: <ShareIcon />, text: <>사파리 아래쪽(또는 위쪽)의 <strong className="text-ink">공유 버튼</strong>을 눌러요</> },
          { icon: <AddSquareIcon />, text: <>목록을 내려 <strong className="text-ink">홈 화면에 추가</strong>를 누르고, 오른쪽 위 <strong className="text-ink">추가</strong>를 눌러요</> },
          { icon: <OwlMark className="size-7 rounded-[6px]" />, text: <>홈 화면에 생긴 <strong className="text-ink">부엉이서재</strong> 아이콘으로 열고, 마이페이지 &gt; 환경설정에서 알림을 켜요</> },
        ]
      : [
          { icon: <MoreIcon />, text: <>크롬 오른쪽 위 <strong className="text-ink">⋮ 메뉴</strong>를 눌러요</> },
          { icon: <AddSquareIcon />, text: <><strong className="text-ink">홈 화면에 추가</strong> 또는 <strong className="text-ink">앱 설치</strong>를 눌러요</> },
          { icon: <OwlMark className="size-7 rounded-[6px]" />, text: <>홈 화면의 <strong className="text-ink">부엉이서재</strong> 아이콘으로 열면 앱처럼 쓸 수 있어요</> },
        ];

  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-3 rounded-md border border-border-card bg-card p-3">
          <span aria-hidden className="w-5 shrink-0 text-center font-display text-t1 text-slate">
            {i + 1}
          </span>
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-sub text-navy">
            {s.icon}
          </span>
          <p className="min-w-0 flex-1 text-b2 text-ink-2">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// 아이폰 공유 버튼: 네모 위로 화살표
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" {...stroke}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

function AddSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" {...stroke}>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </svg>
  );
}
