import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 미리보기 서버는 별도 빌드 폴더를 써서, 이미 켜진 개발 서버와 동시에 실행할 수 있게 한다
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
