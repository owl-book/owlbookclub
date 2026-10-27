"use client";

import { useEffect, useState, useTransition } from "react";
import { InstallGuide } from "@/components/InstallGuide";
import { NotificationPreview } from "@/components/NotificationPreview";
import { OpenExternalBrowser } from "@/components/OpenExternalBrowser";
import { sendTestPush, setPushPref } from "@/lib/push-actions";
import { getPushState, platform, rememberAsk, syncPushSubscription, turnOffPush, turnOnPush, type PushState } from "@/lib/push-client";
import { PUSH_PREF_ITEMS, type PushPrefKey, type PushPrefs } from "@/lib/push-shared";

// 환경설정 > 알림. 이 기기의 상태(켤 수 있음·아이폰 설치 필요·차단됨·켜짐 등)에 따라 한 가지 안내만 보여 준다.
// 알림 종류(찜한 모임·책방 새 모임·전시)는 사람 단위라서 켜져 있을 때만 고를 수 있게 한다.
export function PushSettings({ vapidKey, initialPrefs }: { vapidKey: string; initialPrefs: PushPrefs }) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => {
      if (!alive) return;
      setState(s);
      // 이미 켜진 기기면 서버 기록을 맞춰 둔다(실패해도 화면은 그대로)
      if (s === "on") syncPushSubscription().catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next);
      if (next === "on") rememberAsk("yes");
    } catch {
      setError("잠시 문제가 생겼어요. 조금 뒤에 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return <div aria-hidden className="owl-bone h-72 rounded-lg bg-fill" />;
  }

  if (state === "on") {
    return (
      <div>
        <p role="status" className="flex items-center gap-2 rounded-sm border border-success-border bg-success-surface px-3 py-2.5 text-b2 text-success">
          <CheckIcon />이 기기에서 알림을 받고 있어요
        </p>
        <h3 className="mt-6 text-t2 text-ink">받을 알림</h3>
        <p className="mt-0.5 text-l2 font-normal text-ink-3">아침에 한 번, 모아서 보내요. 고른 것은 내 모든 기기에 함께 적용돼요.</p>
        <PrefSwitches initial={initialPrefs} />
        <TestButton />
        <div className="mt-6 border-t border-border pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(turnOffPush)}
            className="-ml-1 inline-flex min-h-11 items-center px-1 text-l2 font-normal text-ink-3 underline hover:text-ink-2 disabled:opacity-60"
          >
            {busy ? "끄는 중…" : "이 기기에서 알림 끄기"}
          </button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    );
  }

  if (state === "ios-install") {
    return (
      <div>
        <p className="text-b2 text-ink-2">
          아이폰은 <strong className="text-ink">홈 화면에 추가한 앱</strong>에서만 알림을 받을 수 있어요. 한 번만 추가해 두면 돼요.
        </p>
        <div className="mt-4">
          <InstallGuide platform="ios" />
        </div>
        <p className="mt-3 text-l2 font-normal text-ink-3">iOS 16.4 이상에서 쓸 수 있어요. 홈 화면 앱에서도 같은 계정으로 로그인해 주세요.</p>
      </div>
    );
  }

  if (state === "inapp") {
    return (
      <div className="rounded-md border border-info-border bg-info-surface p-4">
        <p className="text-b2 text-ink">카카오톡·인스타그램 안에서 연 화면에서는 알림을 켤 수 없어요.</p>
        <p className="mt-0.5 text-b2 text-ink-2">사파리나 크롬에서 열어 주세요.</p>
        <OpenExternalBrowser kakaotalk={/KAKAOTALK/i.test(navigator.userAgent)} />
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="rounded-md border border-border-card bg-sub p-4 text-b2 text-ink-2">
        이 브라우저에서는 알림을 켤 수 없어요. 크롬·사파리·엣지 최신 버전에서 열어 주세요.
      </p>
    );
  }

  if (state === "denied") {
    const p = platform();
    return (
      <div>
        <div className="rounded-md border border-warning-border bg-warning-surface p-4">
          <p className="text-b2 text-ink">이 기기에서 알림이 차단돼 있어요</p>
          <p className="mt-1 text-b2 text-ink-2">
            {p === "ios"
              ? "아이폰 설정 > 알림 > 부엉이서재 에서 ‘알림 허용’을 켜 주세요."
              : p === "android"
                ? "주소창 왼쪽 아이콘 > 권한(또는 사이트 설정) > 알림 에서 ‘허용’으로 바꿔 주세요."
                : "주소창 왼쪽 아이콘을 눌러 알림을 ‘허용’으로 바꿔 주세요."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => getPushState().then(setState)}
          className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-border px-4 text-l1 text-ink-2 hover:bg-sub"
        >
          바꿨어요, 다시 확인
        </button>
      </div>
    );
  }

  // off: 켤 수 있음
  return (
    <div>
      <NotificationPreview />
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => turnOnPush(vapidKey))}
        className="mt-4 min-h-12 w-full rounded-sm bg-navy py-3 text-t2 text-page hover:bg-navy-hover active:bg-navy-active disabled:opacity-60"
      >
        {busy ? "켜는 중…" : "이 기기에서 알림 켜기"}
      </button>
      <p className="mt-2 text-l2 font-normal leading-normal text-ink-3">누르면 브라우저가 알림을 허락할지 물어요. ‘허용’을 눌러 주세요. 언제든 여기서 끌 수 있어요.</p>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function PrefSwitches({ initial }: { initial: PushPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [failed, setFailed] = useState<PushPrefKey | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: PushPrefKey) => {
    const on = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: on }));
    setFailed(null);
    startTransition(async () => {
      try {
        await setPushPref(key, on);
      } catch {
        setPrefs((p) => ({ ...p, [key]: !on }));
        setFailed(key);
      }
    });
  };

  return (
    <ul className="mt-3 divide-y divide-border rounded-md border border-border-card bg-card">
      {PUSH_PREF_ITEMS.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[item.key]}
            disabled={pending}
            onClick={() => toggle(item.key)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-l1 text-ink">{item.label}</span>
              <span className="mt-0.5 block text-l2 font-normal text-ink-3">{failed === item.key ? "저장하지 못했어요. 다시 눌러 주세요." : item.hint}</span>
            </span>
            <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs[item.key] ? "bg-navy" : "bg-border-control"}`}>
              <span className={`absolute top-0.5 size-6 rounded-full border border-border bg-page transition-transform ${prefs[item.key] ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TestButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              const n = await sendTestPush();
              setResult(n > 0 ? "시험 알림을 보냈어요. 몇 초 안에 도착해요." : "보내지 못했어요. 알림을 껐다가 다시 켜 주세요.");
            } catch {
              setResult("보내지 못했어요. 조금 뒤에 다시 눌러 주세요.");
            }
          })
        }
        className="inline-flex min-h-11 items-center rounded-sm border border-border-strong px-4 text-l1 text-navy hover:bg-sub disabled:opacity-60"
      >
        {pending ? "보내는 중…" : "시험 알림 보내기"}
      </button>
      {result && (
        <p role="status" className="mt-1.5 text-l2 font-normal text-ink-2">
          {result}
        </p>
      )}
    </div>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-2 text-l2 text-error">
      {children}
    </p>
  );
}

function CheckIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}
