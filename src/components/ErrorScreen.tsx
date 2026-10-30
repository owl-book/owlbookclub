"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  retry: () => void;
  title: string; // 어디서 무엇이 안 됐는지(예: "내 서재를 불러오지 못했어요")
  body: string;
  back: { href: string; label: string }; // 다시 시도해도 안 될 때 돌아갈 곳
};

// 화면을 불러오다 문제가 생겼을 때 가운데에 보이는 안내(error.tsx 들이 함께 쓴다).
// 위쪽 로고·메뉴와 아래 안내는 그대로 두고 가운데만 이 화면으로 바뀐다
export function ErrorScreen({ error, retry, title, body, back }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16 text-center">
      <img src="/owl-reading.png" alt="" width={120} height={174} className="mx-auto" />
      <h1 className="mt-3 font-display text-h2 text-ink">{title}</h1>
      <p className="mt-1 text-b2 text-ink-2">{body}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-sm bg-navy px-4 text-l1 font-semibold text-page hover:bg-navy-hover"
        >
          다시 시도
        </button>
        <Link href={back.href} className="inline-flex min-h-11 items-center rounded-sm border border-border-card px-4 text-l1 font-semibold text-ink hover:bg-sub">
          {back.label}
        </Link>
      </div>
      <p className="mt-6 text-l2 text-ink-2">
        <Link href="/contact" className="inline-flex min-h-11 items-center underline">문제 알려주기</Link>
      </p>
      {/* 문의할 때 알려주시면 서버 기록에서 같은 오류를 찾을 수 있다 */}
      {error.digest && <p className="text-l2 text-ink-3">오류 번호 {error.digest}</p>}
    </div>
  );
}
