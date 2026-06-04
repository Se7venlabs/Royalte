// ─────────────────────────────────────────────────────────────────────────
// Royaltē Mission Control — service worker (Brief 015r auto-update).
//
// Pass-through (no offline cache by design — see Brief 015p), but with
// an explicit version constant and update-friendly lifecycle:
//   - install:    skipWaiting() so a new SW activates immediately
//                 instead of waiting for all tabs to close.
//   - activate:   clients.claim() so the new SW takes control of all
//                 open tabs without a reload. The pwa-install.js
//                 controllerchange listener then triggers a refresh
//                 so the new HTML/JS/CSS loads.
//   - message:    responds to {type:'sw-version-query'} with the
//                 current SW_VERSION (used by the sidebar footer to
//                 verify the installed app matches production).
//
// To force every installed Mission Control to update on next launch,
// bump SW_VERSION below. The browser already revalidates /sw.js on
// every navigation (cache-control no-cache header in vercel.json +
// update_via_cache:'none' in the manifest), so the new SW is detected
// the moment a user opens the installed app after a deploy.
// ─────────────────────────────────────────────────────────────────────────

const SW_VERSION = '1.0.1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'sw-version-query') {
    event.source?.postMessage({ type: 'sw-version', version: SW_VERSION });
  }
});
