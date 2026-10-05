// 로그인 쿠키 서명·검증 (server-only 아님: proxy 번들에도 들어감)
// 쿠키 값 = base64url(JSON) + "." + HMAC-SHA256 서명. AUTH_SECRET 이 없으면 로그인 기능 전체가 꺼진다.

export const AUTH_COOKIE = {
  user: "owl_user", // 로그인 상태
  oauth: "owl_oauth", // 로그인 진행 중 위조 방지값(state)과 돌아갈 주소, 10분
  lastProvider: "owl_last_login", // 이 기기에서 마지막으로 쓴 로그인 방법(kakao 등). 로그인 화면 '최근 사용' 표시용, 로그아웃해도 남는다
} as const;

export const LAST_PROVIDER_MAX_AGE = 60 * 60 * 24 * 365; // 1년

export const LOGIN_MAX_AGE = 60 * 60 * 24 * 60; // 60일

export type SessionUser = {
  id: string; // users.id
  name: string; // 화면 표시용 별명
  provider: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function authSecret(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || undefined;
}

export function hasAuthSecret(): boolean {
  return Boolean(authSecret());
}

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signValue(data: object, maxAgeSec: number): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET 환경변수가 없습니다.");
  const body = toB64url(enc.encode(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + maxAgeSec })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${toB64url(new Uint8Array(sig))}`;
}

export async function verifyValue<T>(value: string | undefined | null): Promise<T | null> {
  const secret = authSecret();
  if (!secret || !value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromB64url(body)));
    if (typeof data?.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}

export async function readSessionUser(value: string | undefined | null): Promise<SessionUser | null> {
  const data = await verifyValue<SessionUser>(value);
  return data && typeof data.id === "string" ? { id: data.id, name: data.name, provider: data.provider } : null;
}

// 로그인 후 돌아갈 주소: 우리 사이트 안의 경로만 허용(외부로 튕겨 보내는 악용 방지)
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login") || next.startsWith("/auth")) return "/";
  return next.slice(0, 500);
}
