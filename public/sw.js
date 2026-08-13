// ABU MAFHAL HUB - Progressive Web App Service Worker
const CACHE_NAME = 'abumafhal-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Basic network-first fetch handler for PWA installability requirements
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
