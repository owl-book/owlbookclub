"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { EditResult } from "@/lib/review-actions";

type Props = {
  action: (formData: FormData) => Promise<EditResult>;
  doneHref: string; // 저장에 성공하면 갈 주소(완료 안내와 고친 카드 위치)
  children: ReactNode;
};

const SAVE_FAILED = "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.";

// 화면에 떠 있는 고치기 폼마다 '저장하기'를 적어 둔다. [승인]을 누르면 저장 안 한 폼을 먼저 저장하는 데 쓴다(saveUnsavedEdits)
const savers = new Map<HTMLFormElement, () => Promise<boolean>>();

// 다른 고치기 폼(같은 모임 한꺼번에 고치기)도 같은 목록에 적어 둔다. 돌려준 함수를 부르면 뺀다
export function registerSaver(form: HTMLFormElement, save: () => Promise<boolean>): () => void {
  savers.set(form, save);
  return () => void savers.delete(form);
}

// 승인 화면의 '고치기' 폼. 저장에 실패하면 고치던 내용을 그대로 두고 버튼 위에 이유를 보여 준다.
// <form action>으로 보내면 React가 끝난 뒤 칸을 처음 값으로 되돌리므로, 직접 보내서(onSubmit) 적은 내용을 지킨다.
// 성공하면 완료 안내가 있는 주소로 옮긴다(고친 모습이 위 카드에 보임)
export function EditForm({ action, doneHref, children }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 보내고 결과를 보여 준다. 실패하면 접힌 칸을 펼쳐 이유가 보이게 한다
  async function save(): Promise<boolean> {
    const form = formRef.current;
    if (!form) return false;
    setError(null);
    let result: EditResult;
    try {
      result = await action(new FormData(form));
    } catch {
      // 인터넷이 끊겼거나 관리자 출입증이 만료됐을 때
      result = { error: SAVE_FAILED };
    }
    if (!result) return true;
    setError(result.error);
    const box = form.closest("details");
    if (box) box.open = true;
    form.scrollIntoView({ block: "center" });
    return false;
  }

  // 그릴 때마다 최신 save 로 다시 적어 둔다
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    return registerSaver(form, save);
  });

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        startTransition(async () => {
          if (await save()) router.push(doneHref);
        });
      }}
    >
      {children}
      {error && (
        <p role="alert" className="rounded-xs border border-error bg-card px-3 py-2.5 text-b2 text-error">
          {error} 적은 내용은 그대로 있어요.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="min-h-11 w-full rounded-sm bg-navy py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "저장하는 중…" : "고친 내용 저장 (공개는 안 돼요)"}
      </button>
    </form>
  );
}

// 처음 화면에 나온 값과 하나라도 다르면 '저장 안 한 내용이 있다'고 본다(고른 사진 파일도 포함)
function isChanged(form: HTMLFormElement): boolean {
  return Array.from(form.elements).some(isFieldChanged);
}

// 칸 하나가 처음 화면에 나온 값과 다른지
export function isFieldChanged(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === "file") return (el.files?.length ?? 0) > 0;
    if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
    return el.value !== el.defaultValue;
  }
  if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
  if (el instanceof HTMLSelectElement) return Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
  return false;
}

// [승인] 전에 부른다: 주어진 칸(id) 안의 고치기 폼 중 고친 것을 차례로 저장한다.
// 하나라도 저장에 실패하면 거기서 멈추고 ok=false(승인하지 않음). saved 는 저장한 폼 수
export async function saveUnsavedEdits(scopeIds: string[]): Promise<{ ok: boolean; saved: number }> {
  let saved = 0;
  for (const id of scopeIds) {
    const scope = document.getElementById(id);
    if (!scope) continue;
    for (const [form, save] of savers) {
      if (!scope.contains(form) || !isChanged(form)) continue;
      if (!(await save())) return { ok: false, saved };
      saved++;
    }
  }
  return { ok: true, saved };
}
