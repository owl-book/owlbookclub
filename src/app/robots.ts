import type { MetadataRoute } from "next";

const PRIVATE = ["/go/", "/api/", "/wish", "/plan", "/me", "/login", "/auth/", "/admin"];

// 검색 노출·링크 미리보기에 필요한 로봇만 허용하고, 그 밖의 로봇(경쟁 서비스 수집기·AI 학습 수집기 등)은 전부 거절한다.
// robots.txt 는 '부탁'이라 무시하는 수집기는 proxy.ts 에서 따로 막는다.
const ALLOWED_BOTS = [
  "Googlebot",
  "Yeti", // 네이버
  "Daum", // 다음
  "Bingbot",
  "Applebot",
  "kakaotalk-scrap", // 카카오톡 링크 미리보기
  "facebookexternalhit",
  "Twitterbot",
  "Slackbot",
  "Discordbot",
  "TelegramBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ALLOWED_BOTS, allow: "/", disallow: PRIVATE },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
