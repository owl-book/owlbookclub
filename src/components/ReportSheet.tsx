"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitReport } from "@/lib/report-actions";
import { REPORT_KINDS, REPORT_MESSAGE_MAX, type ReportKind, type ReportResult } from "@/lib/report-kinds";
import { track } from "@/lib/track-client";

type Props = { meetingId: number; storeId: number; closed: boolean };

// 정보 오류·마감 신고. 상세화면 '마지막 확인' 안내 상자 안에서 열고, 화면 아래에서 올라오는 창으로 받는다.
// 로그인 없이 보낼 수 있고, 연락처는 받지 않는다.
export function ReportSheet({ meetingId, storeId, closed }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  // 이미 마감으로 표시된 모임에는 '마감됐어요'를 고를 필요가 없다
  const kinds = REPORT_KINDS.filter((k) => !(closed && k.key === "closed"));
  const needsMessage = kind === "other" && !message.trim();
  const sent = result?.ok === true;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openSheet = () => {
    if (sent) {
      // 보낸 뒤 다시 열면 새로 쓰기
      setKind(null);
      setMessage("");
    }
    setResult(null);
    setOpen(true);
    track("report_click", { meetingId, storeId });
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind || needsMessage) return;
    startTransition(async () => {
      try {
        setResult(await submitReport({ meetingId, kind, message, website: honeypotRef.current?.value }));
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
  };

  return (
    <>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-ink-2">{sent ? "알려주셔서 고마워요." : "다른 점이 있나요?"}</span>
        <button
          ref={triggerRef}
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center px-2 font-semibold text-navy underline underline-offset-2 hover:text-navy-hover"
        >
          {sent ? "더 알려주기" : "알려주기"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 sm:items-center" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-sheet-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <>
                <p id="report-sheet-title" role="status" className="text-t1 text-ink">
                  알려주셔서 고마워요
                </p>
                <p className="mt-2 text-b2 text-ink-2">확인하고 고칠게요. 그 전에 신청하신다면 책방 신청 페이지에서 한 번 더 확인해 주세요.</p>
                <button
                  type="button"
                  onClick={close}
                  autoFocus
                  className="mt-5 min-h-11 w-full rounded-sm bg-navy py-3 text-l1 font-semibold text-white hover:bg-navy-hover"
                >
                  닫기
                </button>
              </>
            ) : (
              <form onSubmit={send}>
                <p id="report-sheet-title" className="text-t1 text-ink">
                  어떤 점이 다른가요?
                </p>

                <fieldset className="mt-4">
                  <legend className="sr-only">다른 점 고르기</legend>
                  <div className="flex flex-wrap gap-2">
                    {kinds.map((k) => (
                      <label
                        key={k.key}
                        className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-card bg-card px-4 text-l1 text-ink-2 hover:bg-sub has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy"
                      >
                        <input
                          type="radio"
                          name="kind"
                          value={k.key}
                          checked={kind === k.key}
                          onChange={() => setKind(k.key)}
                          className="sr-only"
                        />
                        {k.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label htmlFor="report-message" className="mt-5 block text-l1 font-semibold text-ink">
                  자세한 내용 <span className="font-normal text-ink-3">{kind === "other" ? "(꼭 적어 주세요)" : "(안 써도 돼요)"}</span>
                </label>
                <textarea
                  id="report-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={REPORT_MESSAGE_MAX}
                  rows={3}
                  placeholder="예: 책방 인스타그램에 10월 15일로 바뀌었다고 올라왔어요"
                  aria-describedby="report-message-hint"
                  className="mt-1.5 block w-full resize-none rounded-xs border border-border-control bg-card px-3 py-2.5 text-b2 text-ink placeholder:text-ink-3 focus:border-navy focus:outline-2 focus:outline-navy"
                />
                <p id="report-message-hint" className="mt-1 text-l2 font-normal text-ink-3">
                  이름·연락처 같은 개인정보는 적지 말아 주세요.
                </p>

                {/* 사람 눈에는 보이지 않는 칸(자동 프로그램 걸러내기용) */}
                <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

                {result && !result.ok && (
                  <p role="alert" className="mt-3 text-l2 text-error">
                    {result.reason === "too_many"
                      ? "짧은 시간에 여러 번 보내셨어요. 잠시 뒤에 다시 보내 주세요."
                      : result.reason === "invalid"
                        ? "지금은 이 모임에 알려주기를 할 수 없어요."
                        : "보내지 못했어요. 다시 눌러 주세요."}
                  </p>
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    disabled={!kind || needsMessage || pending}
                    className="min-h-11 flex-[2] rounded-sm bg-navy py-3 text-l1 font-semibold text-white hover:bg-navy-hover disabled:bg-fill disabled:text-ink-3"
                  >
                    {pending ? "보내는 중…" : "알려주기"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
