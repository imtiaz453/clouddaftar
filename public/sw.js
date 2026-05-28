self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : { title: "Cloud Daftar", body: "" };
  } catch {
    data = {
      title: "Cloud Daftar",
      body: event.data ? event.data.text() : "",
    };
  }

  const { title, body, icon, badge, url, ...options } = data;

  event.waitUntil(
    self.registration.showNotification(title || "Cloud Daftar", {
      body: body || "",
      icon: icon || "/icons/icon-192.png",
      badge: badge || "/icons/icon-192.png",
      data: { url: url || "/" },
      ...options,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const urlToOpen = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === urlToOpen && "focus" in c);
      if (existing) {
        existing.focus();
      } else {
        clients.openWindow(urlToOpen);
      }
    }),
  );
});
