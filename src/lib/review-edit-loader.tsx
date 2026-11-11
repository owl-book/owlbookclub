"use server";

import type { ReactNode } from "react";
import { BulkMeetingEditForm, ExhibitionEditForm, MeetingEditForm, StoreEditForm } from "@/app/admin/review/edit-forms";
import { requireAdmin } from "@/lib/admin";
import { getPendingExhibition, getPendingMeetingsByIds, getPendingStoreById } from "@/lib/review";

// 승인 화면의 '고치기' 폼을 펼칠 때 서버에서 그 폼 하나만 받아 온다(처음 화면에는 폼을 넣지 않는다).
// 이 길도 관리자만 쓸 수 있고, 아직 대기 중인 것만 돌려준다.
export type EditSpec =
  | { kind: "meeting"; id: number }
  | { kind: "bulk"; ids: number[]; anchor: string; series?: boolean }
  | { kind: "store"; id: number }
  | { kind: "exhibition"; id: number };

export type LoadResult = { ok: true; form: ReactNode } | { ok: false; error: string };

const GONE = "이미 처리했거나 없는 항목이에요. 화면을 새로 고쳐 주세요.";

export async function loadEditForm(spec: EditSpec): Promise<LoadResult> {
  await requireAdmin();
  try {
    if (spec.kind === "meeting") {
      const [m] = await getPendingMeetingsByIds([Number(spec.id)]);
      return m ? { ok: true, form: <MeetingEditForm m={m} /> } : { ok: false, error: GONE };
    }
    if (spec.kind === "bulk") {
      if (!Array.isArray(spec.ids) || typeof spec.anchor !== "string" || spec.anchor.length > 40) return { ok: false, error: GONE };
      const meetings = await getPendingMeetingsByIds(spec.ids.map(Number));
      return meetings.length > 0 ? { ok: true, form: <BulkMeetingEditForm meetings={meetings} anchor={spec.anchor} series={spec.series === true} /> } : { ok: false, error: GONE };
    }
    if (spec.kind === "store") {
      const s = await getPendingStoreById(Number(spec.id));
      return s ? { ok: true, form: <StoreEditForm store={s} /> } : { ok: false, error: GONE };
    }
    if (spec.kind === "exhibition") {
      const e = await getPendingExhibition(Number(spec.id));
      return e ? { ok: true, form: <ExhibitionEditForm e={e} /> } : { ok: false, error: GONE };
    }
    return { ok: false, error: GONE };
  } catch (e) {
    console.error("[owl] load edit form failed", e);
    return { ok: false, error: "폼을 불러오지 못했어요." };
  }
}
