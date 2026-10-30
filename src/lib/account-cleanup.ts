import "server-only";
import { db } from "@/lib/db";
import { UNLINK_MAX_ATTEMPTS, kakaoAdminKey, unlinkKakao } from "@/lib/kakao-unlink";

// 매일 정리(아침 알림과 같은 때 Vercel 이 부른다)
// 1) 탈퇴 때 실패한 카카오 연결 끊기를 다시 시도한다. 성공하거나 30번 실패하면 남겨 둔 카카오 회원번호를 지운다
// 2) 카카오 설정에서 연결을 끊은 뒤 1년 동안 다시 로그인하지 않은 회원을 지운다(찜·기록도 함께 지워짐)
// 0034 설정문 실행 전이면 표·칸이 없어 오류가 나는데, 그 경우 조용히 건너뛴다

const KEEP_UNLINKED_DAYS = 365;

export type CleanupResult = { unlinkRetried: number; unlinkDone: number; unlinkGaveUp: number; unlinkedUsersDeleted: number };

export async function runAccountCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = { unlinkRetried: 0, unlinkDone: 0, unlinkGaveUp: 0, unlinkedUsersDeleted: 0 };

  if (kakaoAdminKey()) {
    const { data: queue, error } = await db().from("provider_unlinks").select("id, provider_user_id, attempts").order("created_at").limit(50);
    if (error) console.error("[owl] cleanup: unlink queue read failed", error.message);
    for (const row of queue ?? []) {
      result.unlinkRetried++;
      try {
        await unlinkKakao(row.provider_user_id);
        await db().from("provider_unlinks").delete().eq("id", row.id);
        result.unlinkDone++;
      } catch (e) {
        const attempts = row.attempts + 1;
        if (attempts >= UNLINK_MAX_ATTEMPTS) {
          await db().from("provider_unlinks").delete().eq("id", row.id);
          result.unlinkGaveUp++;
          console.error("[owl] cleanup: kakao unlink gave up", (e as Error).message);
        } else {
          await db().from("provider_unlinks").update({ attempts, last_error: (e as Error).message.slice(0, 300) }).eq("id", row.id);
        }
      }
    }
  }

  const cutoff = new Date(Date.now() - KEEP_UNLINKED_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: deleted, error: delErr } = await db().from("users").delete().lt("unlinked_at", cutoff).select("id");
  if (delErr) console.error("[owl] cleanup: unlinked users delete failed", delErr.message);
  result.unlinkedUsersDeleted = deleted?.length ?? 0;

  return result;
}
