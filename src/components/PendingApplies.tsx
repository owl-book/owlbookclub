"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setApplied } from "@/lib/me-actions";
import { addDismissed, planLoginHref, readDismissed } from "@/lib/plan-client";

export type PendingItem = { id: number; title: string; storeName: string; when: string };

// '신청하셨나요?' 안내: 신청 페이지를 열어 본 뒤 돌아오지 않아 표시를 놓친 모임을 다음 방문 때 한 번 더 묻는다.
// 자동으로 담지 않고 후보만 보여 준다. '아니요'를 누른 모임은 이 기기에서 다시 묻지 않는다.
// items 를 주지 않으면(첫 화면) 브라우저에서 /api/me/pending 으로 읽는다 → 첫 화면을 미리 만들어 두는 방식이 그대로 유지된다.
export function PendingApplies({ items: initial, loggedIn: initialLoggedIn }: { items?: PendingItem[]; loggedIn?: boolean }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loggedIn, setLoggedIn] = useState(Boolean(initialLoggedIn));
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const apply = (list: PendingItem[]) => {
      const dismissed = new Set(readDismissed());
      if (alive) setItems(list.filter((i) => !dismissed.has(i.id)));
    };
    if (initial) {
      apply(initial);
    } else {
      fetch("/api/me/pending", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { loggedIn?: boolean; items?: PendingItem[] } | null) => {
          if (!d || !alive) return;
          setLoggedIn(Boolean(d.loggedIn));
          apply(d.items ?? []);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [initial]);

  if (items.length === 0 && !savedTitle) return null;

  const dismiss = (id: number) => {
    addDismissed(id);
    setItems((list) => list.filter((i) => i.id !== id));
  };

  const mark = (item: PendingItem) => {
    setFailedId(null);
    startTransition(async () => {
      try {
        await setApplied(item.id, true);
        setItems((list) => list.filter((i) => i.id !== item.id));
        setSavedTitle(item.title);
      } catch {
        setFailedId(item.id);
      }
    });
  };

  const here = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;

  return (
    <section aria-label="신청 확인" className="mb-5 rounded-md border border-info-border bg-info-surface p-4">
      {items.length > 0 && (
        <>
          <p className="text-t2 text-ink">신청 페이지를 열어 본 모임이 있어요</p>
          <p className="mt-0.5 text-b2 text-ink-2">책방에서 신청을 마쳤다면 표시해 두세요. ‘내 모임’에 날짜순으로 모여요.</p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-sm bg-card px-3 py-2.5">
                <Link href={`/m/${item.id}`} className="block hover:text-navy">
                  <span className="block truncate text-l1 text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-l2 font-normal text-ink-3">
                    {item.when} · {item.storeName}
                  </span>
                </Link>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="min-h-11 flex-1 rounded-sm border border-border bg-card text-l1 text-ink-2 hover:bg-sub"
                  >
                    신청 안 했어요
                  </button>
                  {loggedIn ? (
                    <button
                      type="button"
                      onClick={() => mark(item)}
                      disabled={pending}
                      className="min-h-11 flex-[1.4] rounded-sm bg-navy text-l1 font-semibold text-white hover:bg-navy-hover disabled:opacity-60"
                    >
                      책방에서 신청했어요
                    </button>
                  ) : (
                    <a
                      href={planLoginHref(item.id, here)}
                      className="flex min-h-11 flex-[1.4] items-center justify-center rounded-sm bg-navy text-l1 font-semibold text-white hover:bg-navy-hover"
                    >
                      책방에서 신청했어요
                    </a>
                  )}
                </div>
                {failedId === item.id && (
                  <p role="alert" className="mt-1.5 text-l2 text-error">
                    저장하지 못했어요. 다시 눌러 주세요.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {savedTitle && (
        <p role="status" className={`${items.length > 0 ? "mt-3" : ""} text-b2 text-success`}>
          ‘{savedTitle}’을(를) 내 모임에 담았어요.{" "}
          <Link href="/me?tab=mine" className="underline">
            내 모임 보기
          </Link>
        </p>
      )}
    </section>
  );
}
