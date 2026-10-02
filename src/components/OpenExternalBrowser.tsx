"use client";

import { useState } from "react";

// 앱 안의 브라우저에서 지금 페이지를 바깥 브라우저(사파리·크롬)로 열기
// 카카오톡은 전용 주소로 바로 열 수 있고, 안드로이드는 크롬으로 넘길 수 있다. 나머지(인스타 iOS 등)는 주소 복사 안내.
export function OpenExternalBrowser({ kakaotalk }: { kakaotalk: boolean }) {
  const [copied, setCopied] = useState(false);

  const open = async () => {
    const url = window.location.href;
    if (kakaotalk) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    if (/Android/i.test(navigator.userAgent)) {
      const u = new URL(url);
      window.location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("아래 주소를 복사해 사파리에 붙여 넣어 주세요", url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="mt-2.5 inline-flex min-h-11 items-center rounded-sm border border-border-strong bg-white px-3 text-l1 text-navy hover:bg-fill"
      >
        다른 브라우저로 열기
      </button>
      {copied && (
        <p role="status" className="mt-1.5 text-l2 text-success">
          주소를 복사했어요. 오른쪽 위 ⋯ 메뉴의 &lsquo;외부 브라우저로 열기&rsquo;를 누르거나, 사파리에 붙여 넣어 주세요.
        </p>
      )}
    </>
  );
}
