// PWA Service Worker for New Hostel Instance
const CACHE_NAME = 'staysync-instance-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first fetch strategy for HTML pages and Next.js dynamic static chunks
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass service worker for Next.js RSC navigation, hot module updates, API calls, and external domains
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/') || // Firebase reserved auth/hosting namespace
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-State-Tree') ||
    event.request.headers.get('Next-Url') ||
    url.origin !== location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      try {
        const cached = await caches.match(event.request);
        if (cached) return cached;
      } catch (e) {}
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
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
