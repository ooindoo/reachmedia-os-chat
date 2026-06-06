// Service Worker — reachmedia OS
// Handles scheduled notifications (Notification Triggers API on Android)
// and click-to-open on all platforms

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Notification click → open Notion task URL ──────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  // URL is stored in notification data (set when creating the notification)
  const notionUrl = e.notification.data?.notionUrl || null;
  const targetUrl = notionUrl || "/";

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus it and navigate
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if (notionUrl && "navigate" in client) {
              // Open the Notion URL in a new tab from the existing window
              self.clients.openWindow(notionUrl);
            }
            return;
          }
        }
        // App is not open — open the Notion URL directly
        return self.clients.openWindow(targetUrl);
      })
  );
});
