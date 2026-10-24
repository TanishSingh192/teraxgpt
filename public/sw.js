self.addEventListener("push", (event) => {
  let payload = { title: "TeraXGPT", body: "A scheduled action has completed.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(self.registration.showNotification(payload.title || "TeraXGPT", {
    body: payload.body || "Your scheduled action is ready.",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: payload.url || "/" },
    tag: "teraxgpt-scheduled-action",
    renotify: true,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(destination);
        return;
      }
    }
    await self.clients.openWindow(destination);
  })());
});
