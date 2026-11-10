self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {
      body: event.data?.text() || "New notification"
    };
  }

  const title = payload.title || "OurSpace";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "You have a new update",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || "ourspace-update",
      data: {
        url: payload.url || "/"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  );

  if (url.origin !== self.location.origin) return;

  event.waitUntil(
    clients.openWindow(url.href)
  );
});