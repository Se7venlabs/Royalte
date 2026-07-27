// GET /api/canonical-versions
//
// Single source of truth for canonical intelligence engine versions,
// consumed by Mission Control workspaces for freshness comparison
// (Board Addendum, PR #431 / IC-1, 2026-07-27).
//
// Constitutional boundary: Mission Control shall never define its own
// engine version -- it may only compare a persisted scan's recorded
// version against the CURRENT version, sourced here, directly from each
// engine's own exported constant. This endpoint computes nothing; it
// only re-exports what already exists.
//
// Extensible by design (not by current necessity): additional engines
// (Catalog Intelligence, Identity Intelligence, Publishing Intelligence,
// ...) can be added as additional keys when they gain their own
// versioned, freshness-relevant output -- none currently need one.
// Public, unauthenticated, no side effects -- safe to call from any
// workspace page on load.

import { TERRITORY_INTELLIGENCE_VERSION } from './_lib/territory-intelligence.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return res.status(200).json({
    territoryIntelligence: TERRITORY_INTELLIGENCE_VERSION,
  });
}
