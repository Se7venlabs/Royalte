// ─────────────────────────────────────────────────────────────────────
//  Royaltē Developer Mode™ — production safety gate
// ─────────────────────────────────────────────────────────────────────
//
//  Board-approved internal development environment (2026-07-21). Lets a
//  developer skip Login/Registration/Onboarding after a real scan and
//  enter Mission Control immediately, using the real scan payload — no
//  mock data. See vault-auth.js's Developer Mode branch for the actual
//  bypass logic; this file is the sole authority on WHETHER it may run.
//
//  Distinct from the existing "?dev=1" convention used in several
//  workspace files (settings.html, global-music-footprint.html,
//  identity-intelligence.html, media-intelligence.html) — that flag
//  loads hardcoded FIXTURE data for local screenshotting. This module's
//  "?devmode=1" flag never substitutes fixture data; it only skips the
//  auth/onboarding UI gate in front of a real scan's real payload.
//
//  Two independent conditions, both required, checked fresh on every
//  call (no caching — a stale cached "true" surviving into a production
//  navigation would defeat the entire point of this gate):
//
//    1. isDevModeAvailable() — the environment itself must not be
//       production. Explicit denylist first (belt), then an allowlist
//       (suspenders): localhost, 127.0.0.1, or a *.vercel.app preview
//       deployment. Any other hostname (including a misconfigured or
//       future production domain not yet added to the denylist) is
//       rejected by the allowlist never matching it.
//    2. isDevModeActive() — explicit developer opt-in via ?devmode=1.
//       Default OFF; availability alone never activates anything.
// ─────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var PRODUCTION_HOSTNAMES = ['royalte.ai', 'www.royalte.ai'];

  function isDevModeAvailable() {
    var h = (typeof location !== 'undefined' && location.hostname) || '';
    if (PRODUCTION_HOSTNAMES.indexOf(h) !== -1) return false;
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
  }

  function isDevModeActive() {
    if (!isDevModeAvailable()) return false;
    try {
      return new URLSearchParams(location.search).get('devmode') === '1';
    } catch (e) {
      return false;
    }
  }

  window.RoyalteDevMode = { isDevModeAvailable: isDevModeAvailable, isDevModeActive: isDevModeActive };
}());
