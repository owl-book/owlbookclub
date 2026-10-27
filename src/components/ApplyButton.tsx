"use client";

import { useEffect, useRef, useState } from "react";
import { rememberApplyLeave } from "@/lib/plan-client";

const HIDE_KEY = "owl_hide_apply_notice";
const OWL_WORD = "부엉이들의 서재에서 보고왔어요";

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

// 신청 버튼: 누르면 '부엉이들의 서재' 안내 → 책방 사이트로 이동(같은 탭. 인앱 브라우저에서 새 탭은 잘 막힘)
// JS 가 없어도 <a href="/go/{id}"> 로 동작한다.
// 나가기 직전에 모임 번호를 남겨 두면, 돌아왔을 때 상세 화면이 '신청하셨나요?'를 한 번 묻는다(PlanMark).
// canSave: 로그인 기능이 켜져 있어 '내 모임'에 담을 수 있을 때만 그 안내 문구를 보여 준다.
// seriesTotal: 여러 회차를 한 번에 신청하는 묶음 모임이면 전체 회차 수(아니면 0)
// dm: 인스타 DM으로 신청하는 모임이면 버튼·안내 글자를 DM에 맞게 바꾼다(신청 없이 오는 모임은 이 버튼을 쓰지 않는다)
// sms: 문자로 신청하는 모임(신청 주소가 sms:번호)이면 보여 줄 번호. 버튼을 누르면 휴대폰 문자 창이 열린다
export function ApplyButton({
  meetingId,
  storeName,
  canSave = false,
  seriesTotal = 0,
  dm = false,
  sms = null,
}: {
  meetingId: number;
  storeName: string;
  canSave?: boolean;
  seriesTotal?: number;
  dm?: boolean;
  sms?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const wordRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const href = `/go/${meetingId}`;

  // 키보드 사용자를 위해: 창이 열리면 창으로 포커스를 옮기고, Tab 은 창 안에서만 돌고, 닫히면 신청 버튼으로 돌려놓는다
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>("button, input");
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

  const proceed = () => {
    if (dontShow) {
      try {
        localStorage.setItem(HIDE_KEY, "1");
      } catch {}
    }
    rememberApplyLeave(meetingId);
    // /go 는 외부 사이트로 보내는 리다이렉트라 라우터 이동이 아닌 전체 이동이 맞다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = href;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(OWL_WORD);
      setCopied(true);
    } catch {
      // 클립보드가 막힌 인앱 브라우저: 글자를 선택해 두어 길게 눌러 복사할 수 있게
      const el = wordRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <>
      <a
        ref={triggerRef}
        href={href}
        data-no-progress // 누르면 먼저 안내 창이 열려서, 화면 이동 막대를 띄우지 않는다
        onClick={(e) => {
          if (readHidden()) {
            rememberApplyLeave(meetingId);
            return;
          }
          e.preventDefault();
          setCopied(false);
          setOpen(true);
        }}
        className="flex min-h-12 flex-1 items-center justify-center rounded-sm border border-amber-edge bg-amber px-3 text-center text-t2 text-amber-ink hover:bg-amber-hover active:bg-amber-active active:text-page"
      >
        {dm ? "인스타 DM으로 신청하기 ↗" : sms ? "문자로 신청하기 ↗" : "책방에서 신청하기 ↗"}
      </a>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owl-notice-title"
            className="w-full outline-none max-w-md rounded-t-lg bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="owl-notice-title" className="text-t1 text-ink">
              {dm ? "DM에" : sms ? "문자에" : "요청사항이나 비고란에"} <span ref={wordRef} className="text-navy">&lsquo;{OWL_WORD}&rsquo;</span>라고 적어주세요
            </p>
            <p className="mt-4 text-b2 text-ink-2">더 좋은 모임을 소개하는 데 도움이 됩니다. &lsquo;부엉이&rsquo;만 적어주셔도 괜찮습니다.</p>
            <button onClick={copy} className="mt-4 min-h-11 w-full rounded-sm border border-border-strong bg-card py-2.5 text-l1 font-semibold text-navy hover:bg-sub">
              {copied ? "복사했어요 ✓" : "문구 복사하기"}
            </button>

            <div className="mt-4 rounded-md bg-sub px-3 py-2.5 text-b2 text-ink-2">
              {sms ? (
                <>
                  <strong className="text-ink">{storeName}</strong>에 보낼 문자 창이 열려요(<span className="select-all">{sms}</span>). <strong className="text-ink">문자로 신청</strong>해 주세요.
                  컴퓨터에서는 휴대폰으로 이 번호에 문자를 보내 주세요. 정확한 내용과 마감 여부를 꼭 확인해 주세요.
                </>
              ) : dm ? (
                <>
                  <strong className="text-ink">{storeName}</strong> 인스타그램으로 이동해요. <strong className="text-ink">DM(메시지)으로 신청</strong>해 주세요. 정확한
                  내용과 마감 여부를 꼭 확인해 주세요.
                </>
              ) : (
                <>
                  <strong className="text-ink">{storeName}</strong>의 신청 페이지(외부 사이트)로 이동합니다. 신청과 결제는 책방에서
                  진행되며, 정확한 내용·마감 여부를 꼭! 확인해주세요.
                </>
              )}
              {seriesTotal > 1 && <span className="mt-1.5 block">이 신청서로 {seriesTotal}회를 한 번에 신청해요.</span>}
              {canSave && <span className="mt-1.5 block">신청을 마치고 이 화면으로 돌아오면 ‘내 모임’ 일정에 담을 수 있어요.</span>}
            </div>

            <label className="mt-4 flex min-h-11 items-center gap-2 text-b2 text-ink-2">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-5 w-5 accent-navy" />
              다시 보지 않기
            </label>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub">
                닫기
              </button>
              <button onClick={proceed} className="min-h-11 flex-[2] rounded-sm border border-amber-edge bg-amber py-3 text-l1 font-semibold text-amber-ink hover:bg-amber-hover">
                {dm ? "인스타그램으로 이동 ↗" : sms ? "문자 보내기 ↗" : "책방 사이트로 이동 ↗"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
