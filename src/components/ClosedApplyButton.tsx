"use client";

import { useEffect, useRef, useState } from "react";

// 마감된 모임의 아래 버튼. 누르면 '그래도 책방 페이지로 갈까요?'를 묻는다(추가 모집·대기 신청 소식을 놓치지 않게 막지는 않음).
// 열린 모임의 신청 버튼(앰버)과 헷갈리지 않게 테두리 버튼으로 두고, 이동 버튼도 남색으로 한다.
// autoOpen: 예전 화면에서 신청 버튼을 눌렀는데 그사이 마감돼 /go 가 돌려보낸 경우(?closed=1). 들어오자마자 묻는다
// JS 가 없어도 <a href="/go/{id}?ok=1"> 로 바로 책방 페이지에 간다.
export function ClosedApplyButton({ meetingId, storeName, autoOpen = false }: { meetingId: number; storeName: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const href = `/go/${meetingId}?ok=1`;

  // 주소의 ?closed=1 은 창을 닫을 때 지운다: 공유·새로고침했을 때 다시 묻지 않게.
  // (들어오자마자 지우면 Next 가 첫 화면을 맞추면서 주소를 되돌려 놓는다)
  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("closed")) return;
    url.searchParams.delete("closed");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  // 키보드 사용자를 위해: 창이 열리면 창으로 포커스를 옮기고, Tab 은 창 안에서만 돌고, 닫히면 버튼으로 돌려놓는다(ApplyButton 과 같은 방식)
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>("button, a");
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <a
        ref={triggerRef}
        href={href}
        data-no-progress // 누르면 먼저 확인 창이 열려서, 화면 이동 막대를 띄우지 않는다
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-sm border border-border-strong bg-card px-3 py-1 text-center hover:bg-sub"
      >
        <span className="text-l1 font-semibold text-ink-2">신청이 마감된 모임이에요</span>
        <span className="text-l2 font-normal text-navy underline underline-offset-2">책방 페이지 보기 ↗</span>
      </a>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 sm:items-center" onClick={close}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owl-closed-title"
            aria-describedby="owl-closed-desc"
            className="w-full outline-none max-w-md rounded-t-lg bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="owl-closed-title" className="text-t1 text-ink">
              마감된 모임이에요.
              <br />
              그래도 책방 페이지로 갈까요?
            </p>
            <p id="owl-closed-desc" className="mt-3 text-b2 text-ink-2">
              추가 모집, 대기신청에 대한 정보는 책방 페이지에서 확인/문의 가능합니다.
            </p>
            <p className="mt-4 rounded-md bg-sub px-3 py-2.5 text-b2 text-ink-2">
              <strong className="text-ink">{storeName}</strong>의 신청 페이지(외부 사이트)로 이동합니다. 신청과 결제는 책방에서 진행돼요.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={close} className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub">
                닫기
              </button>
              <a href={href} className="flex min-h-11 flex-[2] items-center justify-center rounded-sm bg-navy py-3 text-l1 font-semibold text-page hover:bg-navy-hover">
                책방 페이지로 가기 ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
