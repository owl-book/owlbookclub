"use client";

import { useEffect } from "react";

// 사이트 틀(로고·메뉴)까지 망가졌을 때만 뜨는 비상 화면. 이때는 globals.css·글꼴이 안 붙어서
// 토큰 대신 같은 값을 직접 적는다(page #ffffff, ink #16181c, ink-2 #4e545c, navy #27354f)
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#ffffff", color: "#16181c", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
        <title>잠깐 문제가 생겼어요 · 부엉이들의 서재</title>
        <main style={{ maxWidth: 576, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
          <img src="/owl-reading.png" alt="" width={120} height={174} style={{ display: "block", margin: "0 auto" }} />
          <h1 style={{ fontSize: 22, margin: "12px 0 4px" }}>잠깐 문제가 생겼어요</h1>
          <p style={{ fontSize: 15, color: "#4e545c", margin: 0 }}>잠시 뒤 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 20, minHeight: 44, padding: "0 16px", border: 0, borderRadius: 4, background: "#27354f", color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            다시 시도
          </button>
          {error.digest && <p style={{ marginTop: 24, fontSize: 12, color: "#4e545c" }}>오류 번호 {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
