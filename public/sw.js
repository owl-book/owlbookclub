// 부엉이들의 서재 서비스 워커: 앱 알림을 받아 띄우고, 누르면 해당 화면을 연다.
// 화면을 기기에 저장해 두는 기능(오프라인)은 넣지 않는다: 지난 모임 정보가 그대로 보이면 위험해서.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "부엉이들의 서재";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      // 아침 알림은 하루 한 통: 같은 이름표면 새 알림이 이전 것을 바꿔 끼운다
      tag: data.tag || "owl-daily",
      data: { url: data.url || "/", sendId: data.sendId || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, sendId } = event.notification.data || {};
  const target = new URL(url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      // 열어 봤다는 사실만 센다(운영자 화면의 '열어 본 비율')
      if (sendId) {
        try {
          await fetch("/api/push/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sendId }),
            keepalive: true,
          });
        } catch {
          // 세지 못해도 화면은 연다
        }
      }
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (same) {
        try {
          await same.focus();
          const moved = await same.navigate(target);
          if (moved) return moved;
        } catch {
          // 일부 기기는 이미 열린 창을 옮기지 못한다 → 새 창으로 연다
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
