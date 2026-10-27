"use client";

import { useEffect, useState } from "react";

// 화면을 2화면쯤 내렸을 때 오른쪽 아래에 뜨는 '맨 위로' 버튼. 맨 위 근처에서는 숨는다.
// 화면 아래 알림(.owl-toast: 저장 알림·알림 받기 카드)이 뜨면 가리지 않게 그 위로 올라간다
export function BackToTop() {
  const [show, setShow] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 2);
    const measure = () => {
      const el = document.querySelector(".owl-toast");
      setLift(el ? window.innerHeight - el.getBoundingClientRect().top : 0);
    };
    onScroll();
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  if (!show) return null;

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  // 본문 폭(max-w-xl) 오른쪽 끝에 맞춘다. 넓은 화면에서도 목록 옆에 붙어 보이게
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-xl justify-end px-4"
      style={{ paddingBottom: lift ? lift + 12 : "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={toTop}
        className="owl-back-to-top pointer-events-auto inline-flex size-12 items-center justify-center rounded-full bg-navy text-page ring-1 ring-page/40 hover:bg-navy-hover active:bg-navy-active"
      >
        <span className="sr-only">맨 위로</span>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V5" />
          <path d="M6 11l6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}
