// PWA Service Worker for New Hostel Instance
const CACHE_NAME = 'staysync-instance-v4';

self.addEventListener('install', (event) => {
  // Safe install without force skipWaiting
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          return caches.delete(cache);
        })
      );
    })
  );
});

// Passive fetch listener to satisfy PWA install requirements without intercepting or caching requests
self.addEventListener('fetch', (event) => {
  // Let the browser handle all network requests normally
});

// Handle PWA background Push notifications directly on mobile notification bar
self.addEventListener('push', (event) => {
  let data = { title: 'StaySync Alert', body: 'New notification received', url: '/pgowner' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/himalaya_logo_premium.png',
    badge: '/himalaya_logo_premium.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/pgowner' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification tap to open PWA app directly
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/pgowner';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/pgowner') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
