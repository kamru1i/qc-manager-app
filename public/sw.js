const CACHE_NAME = 'chuti-tracker-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/favicon.ico',
  '/manifest.json',
  '/icon-192.png',
  '/icon.svg',
];

// Install Event - Pre-cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean old caches
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
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS, skip extension schemes like chrome-extension
  if (!event.request.url.startsWith('http')) return;

  // Skip supabase api calls, we handle them via offlineSync.ts and IndexedDB
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response and save to cache if successful (GET requests only)
        if (event.request.method === 'GET' && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If offline and request fails, serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and accessing page, fall back to root / index
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Network error occurred', {
            status: 480,
            statusText: 'Network Unavailable',
          });
        });
      })
  );
});

// Push Event - Receive notification from server
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Leave Tracker Notification';
    const options = {
      body: data.body || 'New notification received',
      icon: self.location.origin + '/icon-192.png',
      badge: self.location.origin + '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      actions: data.actions || []
    };

    if (data.tag) {
      options.tag = data.tag;
      options.renotify = true;
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch {
    // Fallback if data is not JSON
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Leave Tracker Notification', {
        body: text,
        icon: self.location.origin + '/icon-192.png',
        badge: self.location.origin + '/icon-192.png'
      })
    );
  }
});

// Notification Click Event - Open app when notification clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
