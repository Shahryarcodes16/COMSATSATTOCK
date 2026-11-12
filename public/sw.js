// CUI Attock Timetable - Service Worker for Mobile Notifications & Background PWA
const SW_VERSION = 'cui-notif-v1.2';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately so notifications work on the very first visit
  event.waitUntil(self.clients.claim());
});

// Handle notification interaction (tapping on a mobile alert)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no tab is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle incoming Web Push events if a push subscription is dispatched from server
self.addEventListener('push', (event) => {
  let title = '🔔 CUI Attock Class Alert';
  let options = {
    body: 'Upcoming lecture alert',
    icon: '/crest.png',
    badge: '/crest.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
    tag: 'cui-class-reminder',
    renotify: true,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options = {
        ...options,
        ...data,
        icon: data.icon || '/crest.png',
        badge: data.badge || '/crest.png',
        vibrate: data.vibrate || [200, 100, 200],
        data: data.data || { url: '/' },
      };
    } catch {
      options.body = event.data.text() || options.body;
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Message listener from web app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
