"use client";

import { useState } from "react";

// 나만 보는 만족도 1~5. 같은 별을 다시 누르면 비운다(선택 항목).
export function RatingInput({ name, initial }: { name: string; initial: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ""} />
      <div role="radiogroup" aria-label="만족도" className="-ml-1.5 flex">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n}점`}
              onClick={() => setValue(value === n ? null : n)}
              className={`inline-flex size-11 items-center justify-center text-[28px] leading-none ${on ? "text-navy" : "text-border-card hover:text-slate"}`}
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
