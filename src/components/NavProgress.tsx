"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 링크를 누른 뒤 다음 화면이 뜰 때까지 머리글 바로 아래에 흐르는 얇은 막대.
// 뼈대 화면(loading.tsx)이 있는 곳은 그 화면이 곧바로 떠서 막대가 금방 사라지고,
// 뼈대가 없는 화면(로그인·약관 등)으로 갈 때 '눌렸다'는 걸 알려 준다.
const SHOW_DELAY = 120; // 바로 뜨는 화면에서는 깜빡이지 않게 조금 기다렸다 보여 준다
const GIVE_UP = 10_000; // 이동이 취소되는 등 끝을 못 받으면 알아서 사라진다

export function NavProgress() {
  const url = `${usePathname()}?${useSearchParams()}`;
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // 주소가 바뀌면(= 다음 화면이 떴으면) 막대를 숨긴다
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setVisible(false);
  }
  // 아직 켜지지 않은 막대가 화면이 바뀐 뒤 늦게 켜지지 않도록 기다리던 것도 지운다
  useEffect(() => clearTimers, [url]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Next.js 링크는 스스로 e.preventDefault() 를 부르므로 그것으로는 거르지 않는다.
      // 대신 누르면 이동하지 않고 안내 창을 여는 링크(신청 버튼)는 data-no-progress 로 뺀다
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download") || a.hasAttribute("data-no-progress")) return;
      if (a.target && a.target !== "_self") return;
      const next = new URL(a.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      // 같은 화면 안의 이동(같은 주소, #위치)은 넘어가지 않으니 막대를 띄우지 않는다
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      clearTimers();
      timers.current.push(
        window.setTimeout(() => setVisible(true), SHOW_DELAY),
        window.setTimeout(() => setVisible(false), GIVE_UP),
      );
    };
    // 뒤로 가기로 브라우저가 저장해 둔 화면을 그대로 꺼내 보여 줄 때
    const onPageShow = () => {
      clearTimers();
      setVisible(false);
    };

    // 다른 부품이 주소를 바꾸기 전에 지금 주소와 비교하도록, 클릭을 가장 먼저(capture 단계) 본다
    document.addEventListener("click", onClick, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full h-0.5 overflow-hidden" role="status">
      {visible && (
        <>
          <div className="owl-loading h-full w-1/3 bg-navy" />
          <span className="sr-only">다음 화면을 불러오는 중</span>
        </>
      )}
    </div>
  );
}
