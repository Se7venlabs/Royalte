// ─────────────────────────────────────────────────────────────────────────
// Royaltē Mission Control — service worker (Brief 015p Phase 1 PWA).
//
// Minimal pass-through SW. Its job is to make the page installable on
// Chrome/Edge/Android (which require a registered SW for install
// eligibility) and to keep the installed app functioning as a real
// application. It does NOT cache anything offline — Mission Control
// is a live monitoring view; serving stale dashboard data would be
// worse than showing a clean network error. Offline shell caching
// can be a Phase 2 enhancement once the launch shape settles.
//
// Scope: root (/). The SW must be served from /sw.js to claim the
// whole origin. Vercel's catch-all route handles this via /public/sw.js.
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately on update.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open clients without requiring a reload.
  event.waitUntil(self.clients.claim());
});

// Required for Chrome's "installable" criteria: the SW must register a
// fetch handler that can respond to the start_url. We do a transparent
// network pass-through — no caching, no offline fallback.
self.addEventListener('fetch', (event) => {
  // Only intercept top-level navigation + same-origin requests. Letting
  // cross-origin requests pass through untouched avoids breaking CORS
  // and third-party fetches (Supabase, Apple Music CDN, etc.).
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(event.request));
});
