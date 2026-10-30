import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isKakaoAdminAuth } from "@/lib/kakao-unlink";
import { versionOf } from "@/lib/auth";

// 카카오 '연결 끊기 알림'을 받는 주소. 카카오 개발자 사이트 > [앱] > [웹훅] > [연결 해제 웹훅]에 이 주소를 적어 둔다.
// 회원이 카카오 설정에서 우리 서비스와의 연결을 끊으면 카카오가 여기로 알려 온다.
// - 진짜 카카오인지: Authorization 머리글이 'KakaoAK {Admin 키}'인지 확인한다(아니면 아무것도 하지 않음)
// - 연결만 끊은 경우 바로 지우지 않는다: 실수로 끊은 사람도 있어서, 모든 기기에서 로그아웃시키고 끊은 때만 적어 둔다.
//   다시 카카오로 로그인하면 찜·기록이 그대로 이어지고, 1년 동안 돌아오지 않으면 매일 정리가 지운다
// - 카카오계정 자체를 탈퇴한 경우는 돌아올 수 없으니 바로 지운다
// - 우리가 탈퇴 때 끊은 경우에도 알림이 오지만, 회원이 이미 지워졌으니 할 일이 없다
// 카카오는 빠른 응답(200)을 기대하므로, 처리 중 문제가 생겨도 기록만 남기고 200으로 답한다.
export const dynamic = "force-dynamic";

// 카카오계정 탈퇴(ACCOUNT_DELETE)·장기 휴면 등으로 강제 탈퇴(FORCED_ACCOUNT_DELETE): 다시 돌아올 수 없는 경우
const ACCOUNT_GONE = new Set(["ACCOUNT_DELETE", "FORCED_ACCOUNT_DELETE"]);

async function handle(request: NextRequest, params: URLSearchParams) {
  if (!isKakaoAdminAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const userId = params.get("user_id");
  const referrer = params.get("referrer_type") ?? "";
  if (!userId || !/^\d{1,30}$/.test(userId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const { data: user, error } = await db().from("users").select("*").eq("provider", "kakao").eq("provider_user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (user && ACCOUNT_GONE.has(referrer)) {
      // 카카오계정 자체가 지워짐 → 다시 로그인할 수 없으니 기다리지 않고 바로 지운다(찜·기록도 함께)
      const { error: delErr } = await db().from("users").delete().eq("id", user.id);
      if (delErr) throw new Error(delErr.message);
    } else if (user) {
      const { error: upErr } = await db()
        .from("users")
        .update({ unlinked_at: new Date().toISOString(), session_version: versionOf(user) + 1 })
        .eq("id", user.id);
      if (upErr) throw new Error(upErr.message);
    }
    console.log("[owl] kakao unlink notice", { referrer, found: Boolean(user) });
  } catch (e) {
    console.error("[owl] kakao unlink notice failed", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const body = await request.text().catch(() => "");
  return handle(request, new URLSearchParams(body));
}
