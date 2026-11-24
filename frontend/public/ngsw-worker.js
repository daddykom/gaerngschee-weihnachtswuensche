/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

// Angular safety worker, vendored from @angular/service-worker@22.3.0/safety-worker.js.
// Keep this at the old worker URL so existing registrations can retire themselves.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());

  event.waitUntil(
    self.registration.unregister().then(() => {
      console.log('NGSW Safety Worker - unregistered old service worker');
    }),
  );

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const ngswCacheNames = cacheNames.filter((name) => /^ngsw:/.test(name));
      return Promise.all(ngswCacheNames.map((name) => caches.delete(name)));
    }),
  );
});
