// Service Worker for Shop Tracker PWA
const CACHE_NAME = 'shop-tracker-v1';
const CACHE_STRATEGY = 'cache-first';

// App shell files to cache
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/placeholder.svg',
  // Vite builds will be added dynamically
];

// Install event - cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache-first strategy for app shell
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return;
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // If not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache successful responses for app shell files
            if (isAppShellRequest(request)) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(() => {
            // Return offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // For other requests, return a basic offline response
            return new Response(
              JSON.stringify({ 
                error: 'Offline', 
                message: 'This request requires internet connection' 
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
      })
  );
});

// Check if request is for app shell
function isAppShellRequest(request) {
  const url = new URL(request.url);
  return APP_SHELL.some(shellUrl => {
    return url.pathname === shellUrl || 
           url.pathname.endsWith('.html') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.ico');
  });
}

// Background sync for future API sync when online
self.addEventListener('sync', event => {
  if (event.tag === 'backup-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Notify main thread about sync opportunity
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OPPORTUNITY' });
    });
  } catch (error) {
    console.log('Background sync failed:', error);
  }
}