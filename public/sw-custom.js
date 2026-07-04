// Custom logic layered onto the workbox-generated service worker (via
// workbox.importScripts in vite.config.ts). Handles taps on our notifications,
// including the "Wake up" action button on the sleep-timer notification.
//
// The service worker can't touch the Google Sheet itself (no auth token here),
// so it just focuses/opens the app and tells it which action to run. An already
// open tab is messaged directly; otherwise a new window is opened with an
// ?action= param the app reads on load.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || 'open';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all.find((c) => 'focus' in c);
      const message = { type: 'notification-click', action, tag: event.notification.tag };
      if (client) {
        await client.focus();
        client.postMessage(message);
        return;
      }
      const url = new URL(self.registration.scope);
      if (action && action !== 'open') url.searchParams.set('action', action);
      await self.clients.openWindow(url.href);
    })()
  );
});
