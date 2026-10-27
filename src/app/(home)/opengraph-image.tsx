import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SLIDES } from "@/lib/slides";

// 홈 주소를 카톡·문자 등으로 보냈을 때 뜨는 미리보기 그림 = 홈 슬라이더 첫 장(그림 + 제목 + 설명).
// 이 그림이 없으면 메신저가 화면 속 책 표지를 대신 집어 간다.
// 배경 og-intro.jpg 는 public/slides/intro.webp 를 1200×630 으로 오른쪽(부엉이) 기준 자른 것
// (미리보기 그림 만드는 도구가 webp 를 못 읽어서 jpg 로 따로 둔다). 첫 장 그림을 바꾸면 이것도 다시 만든다.
export const alt = "부엉이들의 서재 · 동네책방에서 열리는 독서모임 모아보기";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const slide = SLIDES[0];

export default async function OpengraphImage() {
  const [bg, display, body] = await Promise.all([
    readFile(join(process.cwd(), "src/app/(home)/og-intro.jpg"), "base64"),
    fetch("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/Cafe24Ohsquare.woff").then((r) => r.arrayBuffer()),
    fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Medium.otf").then((r) => r.arrayBuffer()),
  ]);
  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: "#27354f" }}>
        <img src={`data:image/jpeg;base64,${bg}`} width={1200} height={630} style={{ position: "absolute", inset: 0 }} />
        {/* 슬라이더 navy 장과 같은 왼쪽 어둡게 덮개(글씨가 잘 읽히게) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, rgba(18,26,46,0.8), rgba(18,26,46,0.55) 45%, rgba(18,26,46,0) 70%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px", height: "100%" }}>
          <div style={{ fontFamily: "Display", fontSize: 60, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#ffffff", whiteSpace: "pre-line" }}>
            {slide.title}
          </div>
          <div style={{ marginTop: 20, fontFamily: "Body", fontSize: 28, lineHeight: 1.5, color: "#eff1f4", whiteSpace: "pre-line" }}>
            {slide.body}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: 400, style: "normal" },
        { name: "Body", data: body, weight: 500, style: "normal" },
      ],
    },
  );
}
