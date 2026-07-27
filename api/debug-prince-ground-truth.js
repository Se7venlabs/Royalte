// TEMPORARY — Executive Investigation Request: Apple Territory Verification (Prince).
// Independent ground-truth check against Apple's live API, not Royaltē's
// pipeline. Reuses only the existing token minter and low-level HTTP
// client (no acquisition/engine/business logic imported). To be deleted
// after the investigation.
//
// GET /api/debug-prince-ground-truth  — runs the full check, may take ~30-60s.

import { getAppleDeveloperToken } from './apple-token.js';
import { appleGet } from '../provider-acquisition/connectors/apple-music/apple-http.js';
import { ALL_APPLE_STOREFRONTS } from '../lib/territory/canonical-territory-vocabulary.js';

const ARTIST_ID = '155814';
const REFERENCE_STOREFRONT = 'us';
const WAVE_SIZE = 50;
const MAX_IDS_PER_REQUEST = 100;

export default async function handler(req, res) {
  let token;
  try {
    token = getAppleDeveloperToken();
  } catch (err) {
    return res.status(500).json({ error: 'token mint failed', detail: err.message });
  }

  // 1. Full paginated catalog acquisition (reference storefront only).
  const albumIds = [];
  let offset = 0;
  let page = 0;
  let next = true;
  const pageLog = [];
  while (next && page < 20) {
    const path = `/catalog/${REFERENCE_STOREFRONT}/artists/${ARTIST_ID}/albums?limit=25&offset=${offset}`;
    const result = await appleGet(path, token, { maxRetries: 2 });
    if (!result.ok) {
      pageLog.push({ page, offset, httpStatus: result.status, ok: false });
      break;
    }
    const ids = (result.data?.data || []).map(a => a.id).filter(Boolean);
    albumIds.push(...ids);
    pageLog.push({ page, offset, httpStatus: result.status, count: ids.length });
    next = !!result.data?.next;
    offset += 25;
    page += 1;
  }

  // 2. Batch-check availability across all 167 storefronts.
  const idChunks = [];
  for (let i = 0; i < albumIds.length; i += MAX_IDS_PER_REQUEST) {
    idChunks.push(encodeURIComponent(albumIds.slice(i, i + MAX_IDS_PER_REQUEST).join(',')));
  }

  const byStorefront = {};
  for (let i = 0; i < ALL_APPLE_STOREFRONTS.length; i += WAVE_SIZE) {
    const wave = ALL_APPLE_STOREFRONTS.slice(i, i + WAVE_SIZE);
    const settled = await Promise.allSettled(
      wave.map(sf =>
        Promise.all(idChunks.map(idsParam =>
          appleGet(`/catalog/${sf}/albums?ids=${idsParam}`, token, { maxRetries: 1 })
        )).then(results => ({ sf, results }))
      )
    );
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { sf, results } = s.value;
        const anyFailed = results.some(r => !r.ok);
        const matchedCount = results.reduce((n, r) => n + (r.ok ? (r.data?.data?.length || 0) : 0), 0);
        byStorefront[sf] = anyFailed && matchedCount === 0 ? 'ERROR' : (matchedCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE');
      } else {
        byStorefront[s.reason] = 'ERROR';
      }
    }
  }

  const available = Object.keys(byStorefront).filter(sf => byStorefront[sf] === 'AVAILABLE').sort();
  const unavailable = Object.keys(byStorefront).filter(sf => byStorefront[sf] === 'UNAVAILABLE').sort();
  const errored = Object.keys(byStorefront).filter(sf => byStorefront[sf] === 'ERROR').sort();

  return res.status(200).json({
    artistId: ARTIST_ID,
    referenceStorefrontForCatalog: REFERENCE_STOREFRONT,
    catalogPagination: pageLog,
    totalAlbumsAcquired: albumIds.length,
    totalStorefrontsChecked: ALL_APPLE_STOREFRONTS.length,
    totalAvailable: available.length,
    totalUnavailable: unavailable.length,
    totalErrored: errored.length,
    available,
    unavailable,
    errored,
  });
}
