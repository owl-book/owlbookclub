import type { MetadataRoute } from "next";

// 앱 설치 정보: 홈 화면에 추가했을 때의 이름·아이콘·색. 아이폰은 홈 화면에 추가해야 알림을 받을 수 있다
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "부엉이들의 서재",
    short_name: "부엉이서재",
    description: "동네책방에서 열리는 독서모임을 모아 보고, 찜한 모임을 알림으로 챙겨요.",
    lang: "ko",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff", // --color-page
    theme_color: "#ffffff", // --color-page (머리글 띠와 같은 색)
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
