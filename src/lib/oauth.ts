import "server-only";

// 간편 로그인 3종(구글·네이버·카카오). 모두 같은 흐름(OAuth 2.0 인가 코드 방식):
// 1) /auth/{provider} → 각 회사 로그인 화면으로 보냄
// 2) 로그인 후 /auth/{provider}/callback?code=… 로 돌아옴 → code 로 토큰 받기 → 회원 고유번호·별명만 읽기
// 수집 항목 최소화: 회원 고유번호와 별명만 받는다(이메일·전화번호·성별 등은 요청하지 않음).

export type ProviderId = "google" | "naver" | "kakao";

export type OAuthProfile = { providerUserId: string; nickname: string | null };

type Provider = {
  label: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  secretRequired: boolean;
  authorizeUrl: (p: { clientId: string; redirectUri: string; state: string }) => string;
  tokenUrl: string;
  profile: (accessToken: string) => Promise<OAuthProfile>;
};

const env = (name: string) => () => process.env[name]?.trim() || undefined;

async function getJson(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return res.json();
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  kakao: {
    label: "카카오",
    clientId: env("KAKAO_CLIENT_ID"), // REST API 키
    clientSecret: env("KAKAO_CLIENT_SECRET"), // 카카오는 선택(콘솔에서 켰을 때만)
    secretRequired: false,
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "profile_nickname",
      })}`,
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    profile: async (token) => {
      const d = await getJson("https://kapi.kakao.com/v2/user/me", token);
      return { providerUserId: String(d.id), nickname: d.kakao_account?.profile?.nickname ?? d.properties?.nickname ?? null };
    },
  },
  naver: {
    label: "네이버",
    clientId: env("NAVER_CLIENT_ID"),
    clientSecret: env("NAVER_CLIENT_SECRET"),
    secretRequired: true,
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      })}`,
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    profile: async (token) => {
      const d = await getJson("https://openapi.naver.com/v1/nid/me", token);
      if (!d.response?.id) throw new Error("naver profile: no id");
      return { providerUserId: String(d.response.id), nickname: d.response.nickname ?? null };
    },
  },
  google: {
    label: "구글",
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
    secretRequired: true,
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "openid profile",
        prompt: "select_account",
      })}`,
    tokenUrl: "https://oauth2.googleapis.com/token",
    profile: async (token) => {
      const d = await getJson("https://openidconnect.googleapis.com/v1/userinfo", token);
      if (!d.sub) throw new Error("google profile: no sub");
      return { providerUserId: String(d.sub), nickname: d.name ?? d.given_name ?? null };
    },
  },
};

// 버튼 순서: 국내 사용자가 많이 쓰는 순
export const PROVIDER_ORDER: ProviderId[] = ["kakao", "naver", "google"];

export function isProviderId(v: string): v is ProviderId {
  return v in PROVIDERS;
}

// 키가 설정된 로그인만 버튼을 보여준다
export function isProviderReady(id: ProviderId): boolean {
  const p = PROVIDERS[id];
  return Boolean(p.clientId() && (!p.secretRequired || p.clientSecret()));
}

export function redirectUri(origin: string, id: ProviderId): string {
  return `${origin}/auth/${id}/callback`;
}

export async function exchangeCode(id: ProviderId, p: { code: string; state: string; redirectUri: string }): Promise<string> {
  const provider = PROVIDERS[id];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.clientId()!,
    redirect_uri: p.redirectUri,
    code: p.code,
  });
  const secret = provider.clientSecret();
  if (secret) body.set("client_secret", secret);
  if (id === "naver") body.set("state", p.state);

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== "string") {
    throw new Error(`token ${res.status} ${data.error ?? ""} ${data.error_description ?? ""}`.trim());
  }
  return data.access_token;
}
