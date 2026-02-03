// Minimal Service Worker for PWA Installation
// Version: 1.0.88 - V88: PWA detection (displayMode: 'pwa' vs 'browser')

const CACHE_NAME = 'facial-data-v88';
const urlsToCache = [
  '/',
  '/index.html',
  '/recording.html',
  '/complete-v2.html',
  '/test-camera.html',
  '/css/styles.css',
  '/js/recorder-v20.js',
  '/js/pwa-detector.js',
  '/js/prompts.js',
  '/js/storage.js',
  '/js/uploader.js',
  '/js/state.js',
  '/manifest.json'
];

// Install event - cache critical files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        // Don't fail installation if some files aren't available yet
        return cache.addAll(urlsToCache).catch((err) => {
          console.warn('[ServiceWorker] Some files failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - network first, fallback to cache (for better data freshness)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension URLs
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Skip video blob URLs
  if (event.request.url.startsWith('blob:')) {
    return;
  }

  // Skip API calls - always go to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // #claude v85: FORCE test-camera.html to NEVER cache (always fetch fresh from network)
  // This ensures encoder config changes are immediately reflected without browser cache issues
  if (event.request.url.includes('test-camera.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => {
          return new Response('Network error - please check connection', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network request succeeded, cache the response
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            console.log('[ServiceWorker] Serving from cache:', event.request.url);
            return response;
          }
          // If not in cache and network failed, return a basic response
          return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Message event - for communication with the app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[ServiceWorker] Cache cleared');
    });
  }
});
