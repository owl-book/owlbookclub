"use client";

import { useEffect, useRef, useState } from "react";
import { rememberApplyLeave } from "@/lib/plan-client";

const HIDE_KEY = "owl_hide_apply_notice";
const OWL_WORD = "부엉이들의 서재";

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
export function ApplyButton({ meetingId, storeName, canSave = false }: { meetingId: number; storeName: string; canSave?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const wordRef = useRef<HTMLSpanElement>(null);
  const href = `/go/${meetingId}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        className="flex min-h-12 flex-1 items-center justify-center rounded-sm border border-amber-edge bg-amber px-3 text-center text-t2 text-amber-ink hover:bg-amber-hover active:bg-amber-active active:text-white"
      >
        책방에서 신청하기 ↗
      </a>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="owl-notice-title"
            className="w-full max-w-md rounded-t-lg bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="owl-notice-title" className="text-t1 text-ink">
              신청서의 요청사항 또는 비고란에 <span ref={wordRef} className="text-navy">&lsquo;{OWL_WORD}&rsquo;</span>라고 적어주세요.
            </p>
            <p className="mt-1 text-b2 text-ink-2">직접 적으실 땐 &lsquo;부엉이&rsquo;만 적어도 괜찮아요.</p>
            <p className="mt-2 text-b2 text-ink-2">
              더 좋은 책방과 모임을 소개하는 데 도움이 돼요.
              <br />
              &ldquo;어떻게 알고 오셨나요?&rdquo; 칸이 있다면 &lsquo;부엉이들의 서재&rsquo;를 골라주셔도 좋아요.
            </p>
            <button onClick={copy} className="mt-4 min-h-11 w-full rounded-sm border border-border-strong bg-card py-2.5 text-l1 font-semibold text-navy hover:bg-sub">
              {copied ? "복사했어요 ✓" : "‘부엉이들의 서재’ 복사하기"}
            </button>

            <div className="mt-4 rounded-md bg-sub px-3 py-2.5 text-b2 text-ink-2">
              <strong className="text-ink">{storeName}</strong>의 신청 페이지(외부 사이트)로 이동합니다. 신청과 결제는 책방에서
              진행되며, 정확한 내용·마감 여부도 그 페이지가 기준입니다.
              {canSave && <span className="mt-1.5 block">신청을 마치고 이 화면으로 돌아오면 ‘내 모임’ 일정에 담을 수 있어요.</span>}
            </div>

            <label className="mt-4 flex min-h-11 items-center gap-2 text-b2 text-ink-2">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-5 w-5 accent-[var(--color-navy)]" />
              다시 보지 않기
            </label>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub">
                닫기
              </button>
              <button onClick={proceed} className="min-h-11 flex-[2] rounded-sm border border-amber-edge bg-amber py-3 text-l1 font-semibold text-amber-ink hover:bg-amber-hover">
                책방 사이트로 이동 ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
