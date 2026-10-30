"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { EditResult } from "@/lib/review-actions";

type Props = {
  action: (formData: FormData) => Promise<EditResult>;
  doneHref: string; // 저장에 성공하면 갈 주소(완료 안내와 고친 카드 위치)
  children: ReactNode;
};

// 승인 화면의 '고치기' 폼. 저장에 실패하면 고치던 내용을 그대로 두고 버튼 위에 이유를 보여 준다.
// <form action>으로 보내면 React가 끝난 뒤 칸을 처음 값으로 되돌리므로, 직접 보내서(onSubmit) 적은 내용을 지킨다.
// 성공하면 완료 안내가 있는 주소로 옮긴다(고친 모습이 위 카드에 보임)
export function EditForm({ action, doneHref, children }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          let result: EditResult;
          try {
            result = await action(formData);
          } catch {
            // 인터넷이 끊겼거나 관리자 출입증이 만료됐을 때
            result = { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
          }
          if (result) setError(result.error);
          else router.push(doneHref);
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
