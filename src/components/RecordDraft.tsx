"use client";

import { useEffect, useState } from "react";

// 모임 기록을 쓰는 동안 글(인상 깊은 문장·자유 메모)을 이 기기에 잠깐 보관한다.
// 쓰다가 로그인이 풀려 저장하지 못해도, 다시 로그인하고 돌아오면 쓰던 글을 되살린다.
// - 회원마다 따로 보관한다(같은 기기의 다른 회원에게는 되살리지 않음)
// - 7일이 지나면 버린다. 저장·삭제에 성공하면 마이페이지에서 지운다(ClearRecordDraft)
// - 별점은 한 번 누르면 되는 것이라 보관하지 않는다

const FIELDS = ["quote", "memo"] as const;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Draft = { quote: string; memo: string; at: number };

export function recordDraftKey(userId: string, meetingId: number | string) {
  return `owl_record_draft:${userId}:${meetingId}`;
}

function read(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!d || typeof d.at !== "number" || Date.now() - d.at > MAX_AGE_MS) return null;
    return { quote: String(d.quote ?? ""), memo: String(d.memo ?? ""), at: d.at };
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// 기록 입력 칸들과 같은 form 안에 둔다
export function RecordDraft({ userId, meetingId, formId }: { userId: string; meetingId: number; formId: string }) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const key = recordDraftKey(userId, meetingId);
    const field = (name: string) => form.elements.namedItem(name) as HTMLTextAreaElement | null;

    // 저장된 내용과 다르게 쓰던 글이 있으면 되살린다
    const draft = read(key);
    if (draft) {
      const differs = FIELDS.some((f) => (field(f)?.value ?? "") !== draft[f]);
      if (differs) {
        for (const f of FIELDS) {
          const el = field(f);
          if (el) el.value = draft[f];
        }
        setRestored(true);
      } else {
        remove(key);
      }
    }

    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify({ quote: field("quote")?.value ?? "", memo: field("memo")?.value ?? "", at: Date.now() }));
      } catch {}
    };
    form.addEventListener("input", save);
    return () => form.removeEventListener("input", save);
  }, [userId, meetingId, formId]);

  if (!restored) return null;
  return (
    <p role="status" className="rounded-xs bg-sub px-3 py-2.5 text-l2 font-normal leading-normal text-ink-2">
      저장하지 못한 글을 되살렸어요. 확인하고 저장해 주세요.
    </p>
  );
}

// 저장·삭제에 성공한 뒤 마이페이지에서 그 모임의 보관 글을 지운다
export function ClearRecordDraft({ userId, meetingId }: { userId: string; meetingId: string }) {
  useEffect(() => {
    remove(recordDraftKey(userId, meetingId));
  }, [userId, meetingId]);
  return null;
}
