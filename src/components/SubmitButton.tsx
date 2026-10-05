"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  className?: string;
  children: ReactNode;
  pendingText: ReactNode; // 처리하는 동안 버튼에 보일 말(예: "저장하는 중…")
  name?: string;
  value?: string;
  confirm?: string; // 되돌릴 수 없는 제출이면 누르기 전에 한 번 더 묻는다(첫 문장은 제목, 나머지는 설명)
};

// 폼 제출 버튼. 누르면 처리가 끝날 때까지 잠기고 글자가 바뀐다(두 번 눌러 두 번 저장되는 것도 막는다).
// 한 폼에 버튼이 여럿이면(못 갔어요 / 다녀왔어요) 모두 잠그고, 누른 버튼만 글자를 바꾼다.
export function SubmitButton({ className, children, pendingText, name, value, confirm }: Props) {
  const { pending, data } = useFormStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mine = pending && (name == null || data?.get(name) === value);

  if (!confirm) {
    return (
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
  }

  // 되묻는 버튼은 브라우저 확인 창(window.confirm) 대신 화면 가운데 팝업으로 묻는다.
  // 인앱 브라우저·Claude 안 브라우저에서는 확인 창이 막혀 버튼이 아무 반응 없이 끝나기 때문이다.
  // 첫 버튼은 제출 버튼이 아니라서, 화면이 덜 준비됐을 때 눌려도 바로 지워지지 않는다.
  const cut = confirm.indexOf("?") + 1;
  const title = cut > 0 ? confirm.slice(0, cut) : confirm;
  const detail = cut > 0 ? confirm.slice(cut).trim() : "";
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={className}>
        {children}
      </button>

      {/* <dialog>는 폼 안에 있으므로 안의 제출 버튼이 그대로 이 폼을 보낸다 */}
      <dialog
        ref={dialogRef}
        aria-labelledby="owl-confirm-title"
        className="owl-confirm"
        onCancel={(e) => pending && e.preventDefault()} // 처리 중에는 Esc로 닫히지 않게
        onClick={(e) => e.target === e.currentTarget && !pending && close()} // 바깥 어두운 곳을 누르면 닫는다
      >
        <div className="p-5 text-left">
          <p id="owl-confirm-title" className="text-t1 text-ink">
            {title}
          </p>
          {detail && <p className="mt-1.5 text-b2 text-ink-2">{detail}</p>}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="min-h-11 flex-1 rounded-sm border border-border bg-card py-3 text-l1 font-semibold text-ink-2 transition-colors hover:bg-sub disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              name={name}
              value={value}
              disabled={pending}
              aria-busy={mine || undefined}
              className="min-h-11 flex-1 rounded-sm bg-error py-3 text-l1 font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-wait disabled:opacity-60"
            >
              {mine ? pendingText : children}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
