import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

// 아이폰 홈 화면 아이콘(180px). 아이폰이 모서리를 알아서 둥글게 깎는다
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} />, size);
}
