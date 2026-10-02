// 브라우저 → /api/event. 페이지 이동 직전에도 유실되지 않도록 sendBeacon 우선.
export function track(
  type: "search" | "filter" | "share" | "report_click",
  data: { meetingId?: number; storeId?: number; props?: Record<string, unknown> } = {},
) {
  const body = JSON.stringify({ type, path: location.pathname, ...data });
  try {
    if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // 일부 인앱 브라우저는 sendBeacon 이 없거나 막혀 있음 → fetch 로 대체
  }
  fetch("/api/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}
