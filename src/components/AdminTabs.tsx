"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 운영자 화면 탭과 남은 일 수. 화면을 띄워 둔 동안 승인 대기·신고함 숫자만 1분 30초마다 다시 읽는다(운영자 1명이라 실시간 연결 대신 이 정도면 충분).
// - 다른 탭·앱에 가 있는 동안은 묻지 않고, 화면이 다시 보이면 바로 한 번 묻는다
// - 읽지 못하면 이전 숫자를 그대로 둔다(0으로 바꾸면 '할 일 없음'으로 오해)
// - 지금 보고 있는 탭의 숫자가 늘면 목록을 몰래 바꾸지 않고, '목록 새로 보기'를 눌러 고르게 한다(읽던 위치·고치던 내용 보호)
const POLL_MS = 90_000;
const LIVE_KEYS = ["review", "reports"] as const;

const TABS = [
  { key: "review", href: "/admin/review", label: "승인 대기", what: "승인 대기" },
  { key: "reports", href: "/admin/reports", label: "신고함", what: "신고·의견" },
  { key: "covers", href: "/admin/covers", label: "책 표지", what: "" },
  { key: "push", href: "/admin/push", label: "알림", what: "" },
  { key: "stats", href: "/admin/stats", label: "통계", what: "" },
] as const;

export type AdminTabKey = (typeof TABS)[number]["key"];
type Counts = Partial<Record<AdminTabKey, number>>;

export function AdminTabs({ current, counts }: { current: AdminTabKey; counts: Counts }) {
  const router = useRouter();
  const [live, setLive] = useState<Counts>(counts);
  const [synced, setSynced] = useState(counts);

  // 승인·처리 뒤 서버가 새 숫자를 내려 주면 그 숫자를 기준으로 다시 시작한다
  if (counts !== synced) {
    setSynced(counts);
    setLive(counts);
  }

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/counts", { cache: "no-store" });
        if (res.status === 401) {
          stopped = true; // 출입증이 끝났으면 더 묻지 않는다(다음 화면 이동 때 로그인 화면이 나온다)
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { review: number | null; reports: number | null };
        if (stopped) return;
        setLive((prev) => {
          const next = { ...prev };
          for (const k of LIVE_KEYS) if (typeof data[k] === "number") next[k] = data[k];
          return next;
        });
      } catch {
        // 인터넷이 잠깐 끊긴 것 등: 다음 차례에 다시 묻는다
      }
    };
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const currentTab = TABS.find((t) => t.key === current)!;
  const added = (live[current] ?? 0) - (counts[current] ?? 0);

  return (
    <>
      <nav aria-label="운영자 화면" className="border-b border-border">
        <ul className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = t.key === current;
            const count = live[t.key] ?? 0;
            return (
              <li key={t.key} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-t2 ${
                    active ? "border-navy text-ink" : "border-transparent text-ink-3 hover:text-navy"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      aria-label={`남은 일 ${count}개`}
                      className={`rounded-full px-1.5 text-l2 font-semibold ${active ? "bg-navy text-white" : "bg-fill text-ink-2"}`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* 화면 읽기 프로그램에도 새로 들어온 것을 알린다 */}
      <div aria-live="polite">
        {added > 0 && currentTab.what && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border-card bg-sub px-4 py-2">
            <p className="text-b2 text-ink">
              새 {currentTab.what} <strong>{added}건</strong>이 들어왔어요
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex min-h-11 shrink-0 items-center text-l1 font-semibold text-navy underline underline-offset-2"
            >
              목록 새로 보기
            </button>
          </div>
        )}
      </div>
    </>
  );
}
