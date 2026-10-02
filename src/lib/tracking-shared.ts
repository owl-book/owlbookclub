// proxy.ts 와 서버 코드가 함께 쓰는 측정 상수·유틸 (server-only 아님: proxy 번들에도 들어감)

export const COOKIE = {
  visitor: "owl_vid", // 방문자 식별, 1년
  session: "owl_sid", // 세션, 30분 비활동 시 만료
  utm: "owl_utm", // 첫 유입 UTM(first-touch), 1년
  internal: "owl_internal", // 운영자 기기 표시
} as const;

export const HEADER = {
  visitor: "x-owl-vid",
  session: "x-owl-sid",
  utm: "x-owl-utm",
  internal: "x-owl-internal",
  bot: "x-owl-bot",
} as const;

export const SESSION_MAX_AGE = 60 * 30;
export const YEAR = 60 * 60 * 24 * 365;

export type Utm = {
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

const BOT_RE =
  /bot|crawl|spider|slurp|preview|scrap|facebookexternalhit|meta-externalagent|kakaotalk-scrap|yeti|daum|daumoa|bingpreview|headless|lighthouse|curl|wget|python-requests|axios|node-fetch|go-http-client|okhttp|java\//i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}

export function parseUtm(value: string | undefined | null): Utm | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.utm_source === "string" ? parsed : null;
  } catch {
    return null;
  }
}
