"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setApplied } from "@/lib/me-actions";
import { planLoginHref, takeApplyReturn } from "@/lib/plan-client";

type Props = {
  meetingId: number;
  storeName: string;
  loggedIn: boolean;
  applied: boolean;
};

// 모임 상세의 '책방에서 신청했어요' 표시.
// - 책방 사이트에서 이 화면으로 돌아오면 한 번 묻는다(뒤로 가기로 돌아와 페이지가 그대로 복원된 경우도 포함)
// - 놓친 사람을 위해 본문에 '이미 신청하셨나요?' 줄을 늘 둔다
// 부엉이서재는 신청을 받지 않으므로, 문구는 항상 '책방에서' 신청한 사실을 표시하는 것으로 쓴다.
export function PlanMark({ meetingId, storeName, loggedIn, applied: appliedProp }: Props) {
  const [applied, setAppliedState] = useState(appliedProp);
  const [synced, setSynced] = useState(appliedProp);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (appliedProp !== synced) {
    setSynced(appliedProp);
    setAppliedState(appliedProp);
  }

  useEffect(() => {
    const check = () => {
      if (takeApplyReturn(meetingId) && !appliedProp) {
        setDone(false);
        setFailed(false);
        setOpen(true);
      }
    };
    check();
    // 뒤로 가기로 돌아와 이전 화면이 그대로 복원되면 컴포넌트가 다시 그려지지 않으므로 pageshow 로도 확인
    const onShow = (e: PageTransitionEvent) => e.persisted && check();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [meetingId, appliedProp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const save = (on: boolean) => {
    setFailed(false);
    startTransition(async () => {
      try {
        await setApplied(meetingId, on);
        setAppliedState(on);
        if (on) setDone(true);
      } catch {
        setFailed(true);
      }
    });
  };

  const openSheet = () => {
    setDone(false);
    setFailed(false);
    setOpen(true);
  };

  return (
    <>
      {applied ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-success-border bg-success-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-l1 font-semibold text-success">✓ 내 모임에 담긴 모임이에요</p>
            <p className="mt-0.5 text-l2 font-normal leading-normal text-ink-2">책방에서 신청했다고 표시했어요. 취소·변경은 책방에서 해 주세요.</p>
          </div>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending}
            className="inline-flex min-h-11 shrink-0 items-center px-1 text-l2 text-ink-2 underline hover:text-navy disabled:opacity-50"
          >
            표시 취소
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border-card bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-l1 font-semibold text-ink">책방에서 이미 신청하셨나요?</p>
            <p className="mt-0.5 text-l2 font-normal leading-normal text-ink-3">표시해 두면 마이페이지 ‘내 모임’에 날짜순으로 모여요.</p>
          </div>
          <button
            type="button"
            onClick={openSheet}
            className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-border-strong px-3 text-l1 font-semibold text-navy hover:bg-sub"
          >
            내 모임에 담기
          </button>
        </div>
      )}
      {failed && !open && (
        <p role="alert" className="mt-2 text-l2 text-error">
          저장하지 못했어요. 다시 눌러 주세요.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-sheet-title"
            className="w-full max-w-md rounded-t-lg bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <>
                <p id="plan-sheet-title" role="status" className="text-t1 text-ink">
                  내 모임에 담았어요
                </p>
                <p className="mt-2 text-b2 text-ink-2">
                  마이페이지 ‘내 모임’에서 날짜순으로 볼 수 있어요. 모임이 끝나면 다녀왔는지 한 번 여쭤볼게요.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub"
                  >
                    닫기
                  </button>
                  <Link
                    href="/me?tab=mine"
                    className="flex min-h-11 flex-[2] items-center justify-center rounded-sm bg-navy py-3 text-l1 font-semibold text-white hover:bg-navy-hover"
                  >
                    내 모임 보기
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p id="plan-sheet-title" className="text-t1 text-ink">
                  {storeName}에서 신청하셨나요?
                </p>
                <p className="mt-2 text-b2 text-ink-2">
                  책방 신청을 마친 경우에만 눌러 주세요. 여기서는 신청을 받지 않아요. 내 일정에 담아 두기만 해요.
                </p>

                {failed && (
                  <p role="alert" className="mt-3 text-l2 text-error">
                    저장하지 못했어요. 다시 눌러 주세요.
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 hover:bg-sub"
                  >
                    아직이요
                  </button>
                  {loggedIn ? (
                    <button
                      type="button"
                      onClick={() => save(true)}
                      disabled={pending}
                      className="min-h-11 flex-[2] rounded-sm bg-navy py-3 text-l1 font-semibold text-white hover:bg-navy-hover disabled:opacity-60"
                    >
                      {pending ? "담는 중…" : "책방에서 신청했어요"}
                    </button>
                  ) : (
                    <a
                      href={planLoginHref(meetingId, `/m/${meetingId}?planned=1`)}
                      className="flex min-h-11 flex-[2] flex-col items-center justify-center rounded-sm bg-navy py-2 text-white hover:bg-navy-hover"
                    >
                      <span className="text-l1 font-semibold">책방에서 신청했어요</span>
                      <span className="text-l2 font-normal text-dk-ink-2">로그인 후 바로 담겨요</span>
                    </a>
                  )}
                </div>
                <p className="mt-3 text-l2 font-normal text-ink-3">🔒 내 모임은 나만 볼 수 있어요. 책방에도 누가 표시했는지는 알리지 않아요.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
