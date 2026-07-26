// TEMPORARY diagnostic endpoint — Board Pre-Merge Validation Directive, Part 1
// (Live Apple Batch Verification, PR #428). Not part of the approved
// Canonical Artist Territory Intelligence™ design. To be deleted before
// this branch merges — see governance/GLOBAL_MUSIC_FOOTPRINT_CANONICAL_ARTIST_TERRITORY_IMPLEMENTATION.md.
//
// Reuses the existing token minter (api/apple-token.js) and low-level HTTP
// client (provider-acquisition/connectors/apple-music/apple-http.js)
// unmodified — this file adds no new Apple-calling logic, it only exposes
// the exact request AppleMusicConnector.js already issues, for direct
// inspection.
//
// GET /api/_debug-apple-batch-verify?storefronts=us,jp,cn&ids=<id1>,<id2>,<invalid>

import { getAppleDeveloperToken } from './apple-token.js';
import { appleGet } from '../provider-acquisition/connectors/apple-music/apple-http.js';

export default async function handler(req, res) {
  let token;
  try {
    token = getAppleDeveloperToken();
  } catch (err) {
    return res.status(500).json({ error: 'token mint failed', detail: err.message });
  }

  // mode=search — resolve real album IDs for a given artist (US storefront),
  // used only to obtain valid IDs to feed the batch-verify call below.
  if (req.query.mode === 'search') {
    const term = encodeURIComponent(req.query.term || 'Prince');
    const path = `/catalog/us/search?term=${term}&types=albums&limit=10`;
    const result = await appleGet(path, token, { maxRetries: 1 });
    const albums = (result.data?.results?.albums?.data || []).map(a => ({
      id: a.id, name: a.attributes?.name, artistName: a.attributes?.artistName,
    }));
    return res.status(200).json({ httpStatus: result.status, ok: result.ok, albums });
  }

  const storefronts = (req.query.storefronts || 'us').split(',').map(s => s.trim());
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ error: 'ids query param required, comma-separated' });
  }

  const idsParam = encodeURIComponent(ids.join(','));
  const results = {};

  for (const sf of storefronts) {
    const path = `/catalog/${sf}/albums?ids=${idsParam}`;
    const started = Date.now();
    const result = await appleGet(path, token, { maxRetries: 1 });
    results[sf] = {
      requestPath: path,
      httpStatus: result.status ?? null,
      ok: result.ok,
      healthState: result.healthState ?? null,
      durationMs: Date.now() - started,
      dataLength: Array.isArray(result.data?.data) ? result.data.data.length : null,
      returnedIds: Array.isArray(result.data?.data) ? result.data.data.map(d => d.id) : null,
      errors: result.data?.errors ?? null,
      rawBodySample: typeof result.rawText === 'string' ? result.rawText.slice(0, 1500) : null,
    };
  }

  return res.status(200).json({
    requestedIds: ids,
    idsParamAsSent: idsParam,
    storefronts,
    results,
  });
}
