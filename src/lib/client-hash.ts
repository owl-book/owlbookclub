import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { supabaseKey } from "@/lib/env";

// 요청을 보낸 곳(IP)을 되돌릴 수 없는 값으로 바꾼다. 신고·관리자 비밀번호를 짧은 시간에 여러 번 보내는 것을 막는 데만 쓰고,
// IP 원본은 어디에도 저장하지 않는다. 서버 비밀값을 섞으므로 DB 값만으로는 IP를 거꾸로 알아낼 수 없다.
// Vercel 은 x-forwarded-for 맨 앞에 실제 접속 IP 를 넣어 준다(사용자가 보낸 값은 덮어씀).
export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", supabaseKey() ?? "owl").update(`ip:${ip}`).digest("base64url").slice(0, 32);
}
