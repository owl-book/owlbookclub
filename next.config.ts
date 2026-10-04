import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 미리보기 서버는 별도 빌드 폴더를 써서, 이미 켜진 개발 서버와 동시에 실행할 수 있게 한다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
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
