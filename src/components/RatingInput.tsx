"use client";

import { useState } from "react";

// 나만 보는 만족도 1~5. 같은 별을 다시 누르면 비운다(선택 항목).
export function RatingInput({ name, initial }: { name: string; initial: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  // 마우스를 올린 별까지 미리 칠해 보여준다(터치는 제외 — 손 뗀 뒤에도 남아 있지 않게).
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ""} />
      <div role="radiogroup" aria-label="만족도" className="-ml-1.5 flex" onPointerLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = shown != null && n <= shown;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n}점`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(n)}
              onClick={() => setValue(value === n ? null : n)}
              className={`inline-flex size-11 items-center justify-center text-[28px] leading-none ${on ? (hover != null ? "text-slate" : "text-navy") : "text-border-card"}`}
            >
              ★
            </button>
          );
        })}
        <span className="ml-2 self-center text-l2 font-normal text-ink-3">{value ? `${value}점` : "선택 안 함"}</span>
      </div>
    </div>
  );
}
