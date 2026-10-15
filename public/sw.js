// A minimal service worker. It exists so Android browsers treat the site as an installable app
// (full screen from the home screen). It caches nothing: every request goes straight to the
// network, so a new deploy is never served stale (the app's own stale-version reload guard
// in src/utils/lazyWithReload.js keeps working).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  // Only pass the request on. Without a respondWith the browser does its normal network fetch.
  if (event.request.method !== 'GET') return;
});
