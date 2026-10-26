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

// 화면을 통째로 긁어가는 데 흔히 쓰는 프로그램들. 사람 브라우저·검색 로봇·링크 미리보기는 여기에 걸리지 않는다.
const SCRAPER_RE =
  /python-requests|python-urllib|aiohttp|httpx|scrapy|curl|wget|axios|node-fetch|undici|got \(|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|headlesschrome|phantomjs|puppeteer|playwright|selenium|colly|httrack|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|anthropic-ai|perplexitybot|amazonbot|dataforseobot/i;

// 사용자 에이전트가 비어 있거나 수집 프로그램이면 true → proxy 에서 차단
export function isScraperUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return SCRAPER_RE.test(ua);
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  // 브라우저 이름 칸에 주소를 적어 보내는 해킹 도구(예: 'http://…/wp-admin/install.php?step=1')
  if (/^\s*https?:\/\//i.test(ua)) return true;
  return BOT_RE.test(ua);
}

// 우리 사이트에 없는 워드프레스·PHP 관리 화면을 찾아다니는 주소 → 해킹 도구의 방문
export function isProbePath(pathname: string): boolean {
  return /\/wp-|\.php$|\/xmlrpc|\/\.env/i.test(pathname);
}

// 사람이 우리 화면의 버튼을 눌러야만 가는 주소(신청 이동·로그인·찜·내 모임 표시).
// 이런 주소로 바깥에서 곧바로 들어온 방문은 링크를 차례로 두드리는 프로그램으로 본다(로그인 돌아오는 길 /auth/…/callback 은 제외)
export function isButtonOnlyPath(pathname: string): boolean {
  if (/^\/auth\/[^/]+\/callback/.test(pathname)) return false;
  return /^\/(go|auth|wish|plan)(\/|$)/.test(pathname);
}

// '어디서 왔는지(referer)'가 우리 사이트 화면인지. www 유무는 같은 사이트로 본다
export function isSameSiteReferer(referer: string | null | undefined, host: string): boolean {
  if (!referer) return false;
  try {
    const bare = (h: string) => h.replace(/^www\./, "");
    return bare(new URL(referer).host) === bare(host);
  } catch {
    return false;
  }
}

// 개발 서버(내 컴퓨터)에서 연 화면 → 시험 기록이라 항상 운영자 기기로 남긴다
export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
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
