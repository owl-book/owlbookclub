"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isFieldChanged } from "@/components/EditForm";
import { loadEditForm, type EditSpec } from "@/lib/review-edit-loader";

type Props = {
  label: string;
  spec: EditSpec; // 무엇의 폼인지(서버가 이걸로 폼을 만들어 보낸다)
  dataKey: string; // 카드의 원본 값 표식. 바뀌면(저장·다른 폼에서 고침) 펼쳐 둔 폼을 새로 받아 올지 따진다
};

function hasUnsaved(root: HTMLElement | null): boolean {
  return Array.from(root?.querySelectorAll("form") ?? []).some((f) => Array.from(f.elements).some(isFieldChanged));
}

// 승인 화면의 '고치기' 접이식 칸. 처음 화면에는 폼이 없고, 펼칠 때 서버에서 그 폼 하나만 받아 온다.
// - 한 번 받아 온 폼은 접어도 화면에 남는다 → 접기 전에 적은 내용이 그대로고, [승인]·[모두 저장] 때 함께 저장된다
// - 새로고침하면 화면이 새로 만들어져 적던 내용은 사라진다(따로 임시 저장하지 않는다)
// - 저장에 성공하면 저장한 값으로 폼을 새로 받아 온다(처음 값이 옛날 값으로 남지 않게)
// - 같은 모임의 다른 폼에서 저장해 값이 바뀌면, 이 폼에 저장 안 한 내용이 없을 때만 새로 받아 온다
export function LazyEditBox({ label, spec, dataKey }: Props) {
  const rootRef = useRef<HTMLDetailsElement>(null);
  const [form, setForm] = useState<ReactNode>(null);
  const [version, setVersion] = useState(0); // 바뀌면 폼을 처음부터 다시 만든다(적어 둔 값 초기화)
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const loadedKey = useRef<string | null>(null);
  const latest = useRef(0); // 늦게 도착한 옛 응답이 새 응답을 덮지 않게
  const specRef = useRef(spec);
  const keyRef = useRef(dataKey);
  // 서버에 보낼 때 최신 값을 쓰도록, 그린 뒤에 적어 둔다(그리는 도중에는 읽고 쓰지 않는다)
  useEffect(() => {
    specRef.current = spec;
    keyRef.current = dataKey;
  });

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setState("loading");
    try {
      const r = await loadEditForm(specRef.current);
      if (mine !== latest.current) return;
      if (!r.ok) {
        setMessage(r.error);
        setState("error");
        return;
      }
      loadedKey.current = keyRef.current;
      setForm(r.form);
      setVersion((v) => v + 1);
      setState("idle");
    } catch {
      if (mine !== latest.current) return;
      setMessage("폼을 불러오지 못했어요. 인터넷이나 로그인을 확인해 주세요.");
      setState("error");
    }
  }, []);

  // 값이 바뀌었을 때(다른 폼에서 저장한 경우 등): 이 폼에 적던 내용이 없을 때만 새로 받아 온다
  useEffect(() => {
    if (loadedKey.current === null || loadedKey.current === dataKey) return;
    if (!hasUnsaved(rootRef.current)) void load();
  }, [dataKey, load]);

  // 화면이 준비되기 전에 이미 펼쳐졌거나(펼친 뒤 화면이 늦게 붙은 경우), 브라우저가 펼친 채로 되살린 경우:
  // 이때는 펼침 알림(onToggle)이 오지 않으므로 처음에 한 번 직접 확인한다
  useEffect(() => {
    if (rootRef.current?.open) void load();
  }, [load]);

  // 이 칸 안의 폼이 저장에 성공하면(EditForm·BulkEditForm 이 알림) 저장된 값으로 바로 새로 받아 온다
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onSaved = () => void load();
    el.addEventListener("review-saved", onSaved);
    return () => el.removeEventListener("review-saved", onSaved);
  }, [load]);

  return (
    <details
      ref={rootRef}
      className="group mt-2 rounded-sm border border-border bg-card"
      onToggle={(e) => {
        if (e.currentTarget.open && form === null && state !== "loading") void load();
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-l1 font-semibold text-navy [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-3 pt-3 pb-3">
        {form !== null && <Fragment key={version}>{form}</Fragment>}
        {state === "loading" && (
          <p role="status" className="py-4 text-center text-b2 text-ink-3">
            불러오는 중…
          </p>
        )}
        {state === "error" && (
          <div role="alert" className="space-y-2 py-2">
            <p className="text-b2 text-error">{message}</p>
            <button type="button" onClick={() => void load()} className="min-h-11 rounded-sm border border-border-strong bg-card px-4 text-l1 font-semibold text-navy hover:bg-sub">
              다시 시도
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
