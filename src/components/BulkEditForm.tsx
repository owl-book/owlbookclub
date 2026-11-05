"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { isFieldChanged, registerSaver } from "@/components/EditForm";
import type { EditResult } from "@/lib/review-actions";

type Props = {
  save: (formData: FormData) => Promise<EditResult>;
  approve: (formData: FormData) => Promise<void>;
  anchor: string; // 저장한 뒤 돌아올 칸의 id
  series?: boolean; // 정기모임(한 번에 신청하는 회차들): 고치기는 고른 회차만, 승인은 회차 모두 함께
  sessions: { id: number; label: string }[]; // 바꿀 모임 고르기(처음엔 모두 골라 둔다)
  children: ReactNode; // 고칠 칸들. 칸을 감싼 상자에 data-field 를 붙이면 바꾼 칸에 '바꿈'이 보인다
};

const SAVE_FAILED = "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.";

// 승인 화면의 '같은 모임 한꺼번에 고치기'. 처음 값과 달라진 칸만 서버에 보내서,
// 손대지 않은 칸은 모임마다 원래 값이 그대로 남는다. 바꾼 칸과 그 칸을 감싼 상자에는 data-changed 가 붙는다.
// [고친 내용으로 N개 승인]은 저장한 뒤 고른 모임만 바로 공개하고, [저장만 하기]는 공개하지 않는다
export function BulkEditForm({ save, approve, anchor, series, sessions, children }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState(sessions.length);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fields(): Element[] {
    return Array.from(formRef.current?.elements ?? []).filter((el) => el.getAttribute("name") && el.getAttribute("name") !== "ids");
  }

  // 라디오(표지 그림)는 묶음 전체로 본다: 고른 그림이 바뀌었으면 바뀐 것
  function changed(el: Element): boolean {
    if (el instanceof HTMLInputElement && el.type === "radio") {
      return fields().some((x) => x instanceof HTMLInputElement && x.type === "radio" && x.name === el.name && isFieldChanged(x));
    }
    return isFieldChanged(el);
  }

  function changedFields(): Element[] {
    return fields().filter(changed);
  }

  // 바꾼 칸 표시를 다시 그리고, 고른 모임 수를 센다
  function refresh() {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll("[data-changed]").forEach((el) => el.removeAttribute("data-changed"));
    for (const el of changedFields()) {
      el.setAttribute("data-changed", "");
      el.closest("[data-field]")?.setAttribute("data-changed", "");
    }
    setPicked(form.querySelectorAll('input[name="ids"]:checked').length);
  }

  function pickedIds(): string[] {
    return Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked') ?? []).map((el) => el.value);
  }

  // 바꾼 칸만 담는다(사진은 고른 파일, 라디오는 고른 값)
  function collect(): FormData {
    const fd = new FormData();
    for (const el of changedFields()) {
      if (el instanceof HTMLInputElement && el.type === "file") {
        if (el.files?.[0]) fd.append(el.name, el.files[0]);
      } else if (el instanceof HTMLInputElement && el.type === "radio") {
        if (el.checked) fd.append(el.name, el.value);
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        fd.append(el.name, el.value);
      }
    }
    for (const id of pickedIds()) fd.append("ids", id);
    return fd;
  }

  async function saveChanges(): Promise<boolean> {
    const form = formRef.current;
    if (!form) return false;
    setError(null);
    let result: EditResult;
    try {
      result = await save(collect());
    } catch {
      result = { error: SAVE_FAILED };
    }
    if (!result) return true;
    setError(result.error);
    const box = form.closest("details");
    if (box) box.open = true;
    form.scrollIntoView({ block: "center" });
    return false;
  }

  // 책방의 [모두 승인]을 누르면 저장 안 한 내용을 먼저 저장한다(saveUnsavedEdits)
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    return registerSaver(form, async () => (changedFields().length === 0 || pickedIds().length === 0 ? true : saveChanges()));
  });

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onInput={refresh}
      onChange={refresh}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const toApprove = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "approve";
        const n = pickedIds().length;
        if (n === 0) return setError("바꿀 모임을 하나 이상 골라 주세요.");
        const hasChanges = changedFields().length > 0;
        if (!toApprove && !hasChanges) return setError("바꾼 칸이 없어요. 고칠 칸을 먼저 바꿔 주세요.");
        startTransition(async () => {
          if (hasChanges && !(await saveChanges())) return;
          if (!toApprove) return router.push(`/admin/review?done=bulk-edit&n=${n}#${anchor}`);
          const fd = new FormData();
          for (const id of pickedIds()) fd.append("ids", id);
          if (hasChanges) fd.set("saved", "1");
          await approve(fd);
        });
      }}
    >
      {children}

      <fieldset>
        <legend className="text-l2 font-semibold text-ink">
          바꿀 {series ? "회차" : "모임"} <span className="font-normal text-ink-3">({picked}개 골랐어요)</span>
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-x-2">
          {sessions.map((s) => (
            <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-b2 text-ink-3 has-[:checked]:text-ink">
              <input type="checkbox" name="ids" value={s.id} defaultChecked className="size-5 accent-navy" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xs border border-error bg-card px-3 py-2.5 text-b2 text-error">
          {error} 적은 내용은 그대로 있어요.
        </p>
      )}
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <button
          type="submit"
          value="approve"
          disabled={pending}
          aria-busy={pending || undefined}
          className="min-h-11 w-full rounded-sm bg-navy px-2 py-2.5 text-l1 font-semibold text-white hover:bg-navy-hover disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "처리하는 중…" : series ? `고친 내용으로 ${sessions.length}회 모두 승인` : `고친 내용으로 ${picked}개 승인`}
        </button>
        <button
          type="submit"
          value="save"
          disabled={pending}
          className="min-h-11 w-full rounded-sm border border-border-strong bg-card px-2 py-2.5 text-l1 font-semibold text-navy hover:bg-sub disabled:cursor-wait disabled:opacity-60"
        >
          저장만 하기
        </button>
      </div>
      <p className="text-l2 font-normal text-ink-3">
        {series
          ? "승인을 누르면 고친 내용을 저장하고 바로 사이트에 올라가요. 한 번에 신청하는 모임이라, 체크를 뺀 회차도 내용만 그대로이고 승인은 함께 돼요"
          : `[고친 내용으로 ${picked}개 승인]을 누르면 고친 내용을 저장하고 바로 사이트에 올라가요. 체크를 뺀 모임은 그대로 대기함에 남아요`}
      </p>
    </form>
  );
}
