import "server-only";
import { db } from "@/lib/db";

// 관리자 처리 기록(admin_actions, 0011·0032). 무엇을 언제 어떻게 바꿨는지(바꾸기 전·후 값)를 남겨, 잘못 바꾸면 보고 되돌린다.
// 대상 종류마다 칸 하나만 채운다: 모임 meeting_id / 책방 store_id / 전시 exhibition_id / 책 표지 cover_key.
// 기록을 못 남겨도 처리 자체는 그대로 둔다(서버 기록에만 남김).

export type AdminTarget =
  | { type: "meeting"; id: number }
  | { type: "store"; id: number }
  | { type: "exhibition"; id: number }
  | { type: "book_cover"; key: string };

export type AdminAction = "close" | "hide" | "edit" | "ok" | "approve" | "reject" | "upload" | "remove";

type Entry = { target: AdminTarget; action: AdminAction; before?: Record<string, unknown>; after?: Record<string, unknown> };

function targetColumns(t: AdminTarget) {
  switch (t.type) {
    // 모임은 대상 종류 칸을 비워 둔다(기본값이 meeting). 0032 실행 전에도 모임 기록은 그대로 남게
    case "meeting":
      return { meeting_id: t.id };
    case "store":
      return { target_type: "store", store_id: t.id };
    case "exhibition":
      return { target_type: "exhibition", exhibition_id: t.id };
    case "book_cover":
      return { target_type: "book_cover", cover_key: t.key };
  }
}

export async function logAdminActions(entries: Entry[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await db()
    .from("admin_actions")
    .insert(entries.map((e) => ({ ...targetColumns(e.target), action: e.action, before: e.before ?? {}, after: e.after ?? {} })));
  if (error) console.error("[owl] admin action log failed", error.message);
}

export async function logAdminAction(target: AdminTarget, action: AdminAction, before?: Record<string, unknown>, after?: Record<string, unknown>): Promise<void> {
  await logAdminActions([{ target, action, before, after }]);
}
