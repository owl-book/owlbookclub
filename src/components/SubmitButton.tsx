"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  className?: string;
  children: ReactNode;
  pendingText: ReactNode; // 처리하는 동안 버튼에 보일 말(예: "저장하는 중…")
  name?: string;
  value?: string;
  confirm?: string; // 되돌릴 수 없는 제출이면 누르기 전에 한 번 더 묻는다
};

// 폼 제출 버튼. 누르면 처리가 끝날 때까지 잠기고 글자가 바뀐다(두 번 눌러 두 번 저장되는 것도 막는다).
// 한 폼에 버튼이 여럿이면(못 갔어요 / 다녀왔어요) 모두 잠그고, 누른 버튼만 글자를 바꾼다.
export function SubmitButton({ className, children, pendingText, name, value, confirm }: Props) {
  const { pending, data } = useFormStatus();
  const [asking, setAsking] = useState(false);
  const mine = pending && (name == null || data?.get(name) === value);

  // 되묻는 버튼은 브라우저 확인 창(window.confirm) 대신 화면 안에서 묻는다.
  // 인앱 브라우저 등에서는 확인 창이 막혀 버튼이 아무 반응 없이 끝나기 때문이다.
  // 첫 버튼은 제출 버튼이 아니라서, 화면이 덜 준비됐을 때 눌려도 바로 지워지지 않는다.
  if (confirm && !asking && !pending) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={className}>
        {children}
      </button>
    );
  }

  const submit = (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={mine || undefined}
      className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}
    >
      {mine ? pendingText : children}
    </button>
  );
  if (!confirm) return submit;

  return (
    <div role="alertdialog" aria-label={confirm} className="mt-2 rounded-md border border-error-border bg-error-surface p-4 text-center">
      <p className="text-b2 text-ink">{confirm}</p>
      <div className="mt-3 flex flex-col items-center gap-1">
        {submit}
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={pending}
          className="inline-flex min-h-11 items-center px-3 text-l2 text-ink-2 hover:text-navy disabled:opacity-60"
        >
          취소
        </button>
      </div>
    </div>
  );
}
