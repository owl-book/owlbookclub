"use client";

import { useRef, type ReactNode } from "react";
import { saveUnsavedEdits } from "@/components/EditForm";

type Props = {
  action: (formData: FormData) => Promise<void>;
  scopeIds: string[]; // 승인 전에 저장할 고치기 폼이 들어 있는 칸들의 id
  className?: string;
  children: ReactNode; // 숨은 칸(모임·책방 번호)과 SubmitButton
};

// 승인 화면의 [승인] 폼. [고친 내용 저장]을 누르지 않았어도, 고친 칸이 있으면 먼저 저장하고 승인한다.
// 저장에 실패하면 승인하지 않는다(그 고치기 칸이 펼쳐지며 이유가 보인다). 저장하는 동안에도 버튼은 '처리하는 중'으로 잠긴다
export function ApproveForm({ action, scopeIds, className, children }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className={className}
      action={async (formData) => {
        const { ok, saved } = await saveUnsavedEdits(scopeIds);
        if (!ok) {
          formRef.current?.querySelector("dialog")?.close(); // 되묻는 팝업이 떠 있으면 닫아 이유가 보이게
          return;
        }
        if (saved > 0) formData.set("saved", "1");
        await action(formData);
      }}
    >
      {children}
    </form>
  );
}
