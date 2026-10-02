// Supabase 주소는 대시보드에서 'https://xxx.supabase.co/rest/v1/' 형태로 복사되기도 해서 앞부분만 쓴다
export function supabaseUrl(): string | undefined {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function supabaseKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}
