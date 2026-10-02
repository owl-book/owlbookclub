import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/env";

// 서버 전용 클라이언트. secret 키는 브라우저로 절대 보내지 않는다.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function hasDb(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}
