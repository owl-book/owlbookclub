import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { AppIcon, BadgeIcon, loadOwlSrc } from "@/lib/app-icon";

// 앱 설치 정보(manifest)와 알림이 쓰는 아이콘 PNG. 조립할 때 한 번 그려 두고 그대로 쓴다
const ICONS = {
  "icon-192.png": { size: 192, badge: false, scale: 0.8 },
  "icon-512.png": { size: 512, badge: false, scale: 0.8 },
  "icon-maskable-512.png": { size: 512, badge: false, scale: 0.62 },
  "badge-96.png": { size: 96, badge: true, scale: 0 },
} as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[name]">) {
  const { name } = await ctx.params;
  const icon = ICONS[name as keyof typeof ICONS];
  if (!icon) notFound();
  const { size, badge, scale } = icon;
  const image = badge ? <BadgeIcon size={size} /> : <AppIcon size={size} src={await loadOwlSrc()} scale={scale} />;
  return new ImageResponse(image, { width: size, height: size });
}
