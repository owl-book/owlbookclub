"use client";

import { useRef, type ReactNode } from "react";
import { saveUnsavedEdits } from "@/components/EditForm";
import type { ApproveResult } from "@/lib/review-actions";

type Props = {
  action: (formData: FormData) => Promise<ApproveResult | void>;
  scopeIds: string[]; // 승인 전에 저장할 고치기 폼이 들어 있는 칸들의 id
  removeId?: string; // 승인되면 화면에서 뺄 카드의 id. 없으면 서버가 돌려준 대로 화면을 옮긴다(redirect)
  storeId?: string; // 모임을 승인하면 함께 공개되는 책방 칸의 id(함께 공개됐을 때 같이 뺀다)
  className?: string;
  children: ReactNode; // 숨은 칸(모임·책방 번호)과 SubmitButton
};

function message(r: ApproveResult, saved: boolean): string {
  const s = saved ? "고친 내용을 저장하고 " : "";
  if (r.done === "store") return `${s}책방을 공개했어요. 모임은 따로 승인해 주세요.`;
  const base = r.n > 0 ? `${s}모임 ${r.n}개를 공개했어요.` : saved ? "고친 내용을 저장했어요." : "";
  return `${base}${r.store ? " 책방도 함께 공개했어요." : ""}`.trim() || "공개했어요.";
}

// 카드를 화면에서 뺀다. 페이지 전체를 서버에서 다시 그리지 않으므로 빠르다.
// 책방 묶음에 남은 카드가 없으면 묶음도 뺀다
function removeCard(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const group = el.closest<HTMLElement>('li[id^="group-"]');
  el.hidden = true;
  if (!group || group === el) return;
  const left = [...group.querySelectorAll<HTMLElement>('[id^="m-"], [id^="s-"]')].some((x) => !x.closest("[hidden]"));
  if (!left) group.hidden = true;
}

function flash(text: string) {
  const box = document.getElementById("review-flash");
  if (!box) return;
  box.textContent = text;
  box.hidden = false;
  box.scrollIntoView({ block: "nearest" });
}

// 승인 화면의 [승인] 폼. [고친 내용 저장]을 누르지 않았어도, 고친 칸이 있으면 먼저 저장하고 승인한다.
// 저장에 실패하면 승인하지 않는다(그 고치기 칸이 펼쳐지며 이유가 보인다). 저장하는 동안에도 버튼은 '처리하는 중'으로 잠긴다
export function ApproveForm({ action, scopeIds, removeId, storeId, className, children }: Props) {
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
        const result = await action(formData);
        if (!result || !removeId) return;
        // 되묻는 팝업이 카드 안에 있으므로, 카드를 빼기 전에 닫는다
        formRef.current?.querySelector("dialog")?.close();
        if (storeId && result.store) removeCard(storeId);
        removeCard(removeId);
        flash(message(result, saved > 0));
      }}
    >
      {children}
    </form>
  );
}
