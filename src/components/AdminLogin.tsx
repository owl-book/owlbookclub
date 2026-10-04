"use client";

import { useActionState } from "react";
import { loginAdmin, type LoginState } from "@/lib/admin-actions";

const MESSAGES = {
  wrong: "비밀번호가 맞지 않아요.",
  locked: "여러 번 틀려서 잠시 막아 두었어요. 10분 뒤에 다시 해 주세요.",
  off: "관리자 비밀번호가 설정되지 않았어요.",
} as const;

// 관리자 신고함 들어가기. 비밀번호 관리 앱이 자동으로 채울 수 있게 표준 비밀번호 칸을 쓴다
export function AdminLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAdmin, undefined);
  return (
    <form action={action} className="mx-auto mt-10 max-w-sm rounded-md border border-border-card bg-card p-5">
      <h1 className="font-display text-h2 text-ink">신고함</h1>
      <p className="mt-1 text-b2 text-ink-2">운영자만 들어올 수 있어요.</p>
      {/* 비밀번호 관리 앱이 어느 계정의 비밀번호인지 알 수 있게 숨은 아이디 칸을 둔다 */}
      <input type="text" name="username" autoComplete="username" defaultValue="owl-admin" hidden readOnly />
      <label htmlFor="admin-password" className="mt-5 block text-l1 font-semibold text-ink">
        관리자 비밀번호
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        aria-invalid={state?.error ? true : undefined}
        aria-describedby={state?.error ? "admin-login-error" : undefined}
        className="mt-1.5 block min-h-11 w-full rounded-xs border border-border-control bg-card px-3 text-b1 text-ink focus:border-navy focus:outline-2 focus:outline-navy"
      />
      {state?.error && (
        <p id="admin-login-error" role="alert" className="mt-2 text-l2 text-error">
          {MESSAGES[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-11 w-full rounded-sm bg-navy py-3 text-l1 font-semibold text-white hover:bg-navy-hover disabled:opacity-60"
      >
        {pending ? "확인하는 중…" : "들어가기"}
      </button>
    </form>
  );
}
