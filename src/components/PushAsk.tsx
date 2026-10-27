"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPushState, rememberAsk, shouldAsk, turnOnPush, WISHED_EVENT, type WishedDetail } from "@/lib/push-client";

// 찜한 바로 그 순간, 알림을 받을지 한 번 묻는 작은 카드(화면 아래).
// - 사이트에 들어오자마자 묻지 않는다: 이유를 모르면 대부분 '차단'을 누르고, 한 번 차단하면 되돌리기 어렵다
// - 처음 한 번만 묻고, '괜찮아요'를 누르면 30일 동안 묻지 않는다(기기에 기억)
// - 이미 켰거나 차단했거나 켤 수 없는 기기에는 묻지 않는다
const QUESTION: Record<WishedDetail["kind"], string> = {
  meeting: "모임 3일 전과 당일 아침에 알려드릴까요?",
  store: "이 책방에 새 모임이 올라오면 알려드릴까요?",
  exhibition: "전시가 끝나기 3일 전에 알려드릴까요?",
};

type View = { step: "ask"; kind: WishedDetail["kind"]; ios: boolean } | { step: "done" } | { step: "blocked" };

export function PushAsk({ vapidKey }: { vapidKey: string }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const onWished = async (e: Event) => {
      if (!shouldAsk()) return;
      const state = await getPushState();
      if (state !== "off" && state !== "ios-install") return;
      // 상세 화면 아래 고정 띠(찜·신청 버튼)를 가리지 않게 그 위에 띄운다
      setLift(document.querySelector(".owl-action-bar")?.getBoundingClientRect().height ?? 0);
      setView({ step: "ask", kind: (e as CustomEvent<WishedDetail>).detail.kind, ios: state === "ios-install" });
    };
    window.addEventListener(WISHED_EVENT, onWished);
    return () => window.removeEventListener(WISHED_EVENT, onWished);
  }, []);

  // 결과 안내는 잠깐 보여 주고 닫는다
  useEffect(() => {
    if (view?.step !== "done" && view?.step !== "blocked") return;
    const t = window.setTimeout(() => setView(null), 5000);
    return () => window.clearTimeout(t);
  }, [view]);

  if (!view) return null;

  const decline = () => {
    rememberAsk("no");
    setView(null);
  };

  const accept = async () => {
    setBusy(true);
    try {
      const state = await turnOnPush(vapidKey);
      if (state === "on") {
        rememberAsk("yes");
        setView({ step: "done" });
      } else {
        rememberAsk("no");
        setView(state === "denied" ? { step: "blocked" } : null);
      }
    } catch {
      rememberAsk("no");
      setView(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4" style={{ paddingBottom: lift ? lift + 12 : "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div role={view.step === "ask" ? "dialog" : "status"} aria-label="알림 받기" className="owl-toast pointer-events-auto w-full max-w-sm rounded-md border border-dk-border bg-ink p-4 text-page">
        {view.step === "ask" ? (
          <>
            <p className="text-t2">{QUESTION[view.kind]}</p>
            <p className="mt-0.5 text-b2 text-page/75">
              {view.ios ? "아이폰은 홈 화면에 추가하면 알림을 받을 수 있어요." : "아침에 한 번, 모아서 보내드려요."}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={decline} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border border-page/30 px-3 text-l1 text-page hover:bg-page/10">
                괜찮아요
              </button>
              {view.ios ? (
                <Link
                  href="/me/settings"
                  onClick={() => {
                    rememberAsk("no");
                    setView(null);
                  }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-page px-3 text-l1 font-semibold text-navy hover:bg-fill"
                >
                  방법 보기
                </Link>
              ) : (
                <button type="button" disabled={busy} onClick={accept} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-page px-3 text-l1 font-semibold text-navy hover:bg-fill disabled:opacity-70">
                  {busy ? "켜는 중…" : "알림 받기"}
                </button>
              )}
            </div>
          </>
        ) : view.step === "done" ? (
          <p className="flex items-center gap-2 text-b2">
            알림을 켰어요.
            <Link href="/me/settings" onClick={() => setView(null)} className="inline-flex min-h-11 items-center underline">
              받을 알림 고르기
            </Link>
          </p>
        ) : (
          <p className="text-b2">알림이 차단됐어요. 마이페이지 &gt; 환경설정에서 다시 켜는 방법을 볼 수 있어요.</p>
        )}
      </div>
    </div>
  );
}
