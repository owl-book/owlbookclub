import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hasDb } from "@/lib/db";

// 관리자(운영자 1명) 출입. 로그인 기능과 상관없이, 사이트 설정의 ADMIN_PASSWORD 하나로 연다.
// - 기기에는 비밀번호가 아니라 서버만 만들 수 있는 출입증(만료 시각 + 서명)을 저장한다
// - 서명 열쇠를 비밀번호에서 만들기 때문에, 비밀번호를 바꾸면 이전 출입증은 모두 무효가 된다
// - 비밀번호가 16자보다 짧으면 관리자 화면 전체를 끈다(약한 비밀번호로 열리지 않게)

export const ADMIN_COOKIE = "owl_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 30; // 30일
export const ADMIN_PASSWORD_MIN = 16;

function adminPassword(): string | undefined {
  const p = process.env.ADMIN_PASSWORD?.trim();
  return p && p.length >= ADMIN_PASSWORD_MIN ? p : undefined;
}

export function isAdminEnabled(): boolean {
  return Boolean(adminPassword()) && hasDb();
}

function sessionKey(password: string): Buffer {
  return createHash("sha256").update(`owl-admin-session\0${password}`).digest();
}

function sign(password: string, exp: number): string {
  return createHmac("sha256", sessionKey(password)).update(`owl-admin:${exp}`).digest("base64url");
}

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

// 비밀번호 비교: 길이와 상관없이 같은 시간이 걸리도록 해시끼리 비교한다
export function checkPassword(input: string): boolean {
  const p = adminPassword();
  if (!p) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return sameBytes(h(input), h(p));
}

export function makeAdminToken(): string {
  const p = adminPassword();
  if (!p) throw new Error("ADMIN_PASSWORD 가 없습니다.");
  const exp = Math.floor(Date.now() / 1000) + ADMIN_MAX_AGE;
  return `${exp}.${sign(p, exp)}`;
}

function verifyAdminToken(value: string | undefined): boolean {
  const p = adminPassword();
  if (!p || !value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!Number.isSafeInteger(exp) || exp < Date.now() / 1000 || !sig) return false;
  return sameBytes(Buffer.from(sig), Buffer.from(sign(p, exp)));
}

export async function isAdmin(): Promise<boolean> {
  if (!isAdminEnabled()) return false;
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

// 관리자 동작은 화면을 거치지 않고 직접 호출될 수도 있으므로, 동작마다 맨 앞에서 부른다
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다.");
}

// 출입증 쿠키: 화면 코드에서 읽을 수 없고(httpOnly), https 에서만 보내고, 다른 사이트에서 시작된 요청에는 실리지 않는다(strict).
// /admin 아래 주소에만 실어 보낸다.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/admin",
  maxAge: ADMIN_MAX_AGE,
};
