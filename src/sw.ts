/// <reference lib="webworker" />
// Service worker: offline app shell, cached fonts and thumbnails, and the
// "Share → Curio Cabinet" target (which arrives as a POST with optional photo).
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const SHARE_CACHE = 'curio-share';

// Share target: stash any shared photo, then hand off to the app at /share?…
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const params = new URLSearchParams();
      for (const key of ['title', 'text', 'url']) {
        const v = form.get(key);
        if (typeof v === 'string' && v) params.set(key, v);
      }
      const photo = form.get('photo');
      if (photo instanceof File && photo.size) {
        const cache = await caches.open(SHARE_CACHE);
        await cache.put('/shared-photo', new Response(photo, { headers: { 'content-type': photo.type, 'x-name': encodeURIComponent(photo.name) } }));
        params.set('photo', '1');
      }
      return Response.redirect(`/share?${params}`, 303);
    })(),
  );
});

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 30 })] }),
);

// Thumbnails, covers and favicons from anywhere: keep a few hundred for offline browsing.
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin !== self.location.origin && !url.pathname.includes('/storage/v1/object/sign/'),
  new CacheFirst({ cacheName: 'thumbnails', plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true })] }),
);
