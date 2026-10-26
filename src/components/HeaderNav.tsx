"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 헤더 오른쪽 끝 메뉴 버튼(☰): 누르면 헤더 바로 아래로 독자용 메뉴(모임 | 책방 | 전시)가 펼쳐진다.
// 좁은 휴대폰에서 메뉴 글자가 헤더에 다 들어가지 않아 버튼 하나로 접었다.
// 모임 상세(/m)는 '모임', 책방 상세(/s)는 '책방', 전시 글(/e)은 '전시'를 지금 보는 메뉴로 표시한다
const ITEMS = [
  { href: "/", label: "모임", match: (p: string) => p === "/" || p.startsWith("/m/") },
  { href: "/stores", label: "책방", match: (p: string) => p.startsWith("/stores") || p.startsWith("/s/") },
  { href: "/exhibitions", label: "전시", match: (p: string) => p.startsWith("/exhibitions") || p.startsWith("/e/") },
];

export function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 다른 화면으로 넘어가면 닫는다
  useEffect(() => setOpen(false), [pathname]);

  // Esc 로 닫고, 메뉴 버튼으로 초점을 돌려준다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="header-menu"
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-page/80 hover:bg-navy-hover hover:text-page focus-visible:outline-page"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          {/* 메뉴 밖(어두워진 부분)을 누르면 닫힌다 */}
          <div aria-hidden onClick={() => setOpen(false)} className="fixed inset-x-0 bottom-0 top-14 bg-navy-900/30" />
          <nav id="header-menu" aria-label="메뉴" className="absolute inset-x-0 top-full border-b border-border bg-page">
            <ul className="mx-auto max-w-xl py-2">
              {ITEMS.map((it) => {
                const active = it.match(pathname);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center border-l px-4 text-t2 ${
                        active ? "border-navy bg-sub font-semibold text-navy" : "border-transparent text-ink-2 hover:bg-sub hover:text-navy"
                      }`}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
