import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 미리보기 서버는 별도 빌드 폴더를 써서, 이미 켜진 개발 서버와 동시에 실행할 수 있게 한다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // 모든 화면 공통 보안 머리글: 다른 사이트가 우리 화면을 액자처럼 끼워 넣지 못하게 하고(클릭재킹),
        // 파일 종류를 브라우저가 멋대로 추측하지 못하게 하고, https 만 쓰게 한다
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // 알림 프로그램: 늘 최신을 받도록 저장하지 않고, 이 사이트 파일만 불러올 수 있게 한다
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // 관리자 화면: 어디에도 저장(캐시)하지 않고, 검색에 나오지 않게 한다
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
