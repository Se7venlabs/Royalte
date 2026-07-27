// TEMPORARY diagnostic endpoint — Canonical Artist Presence™ refactor research.
// Not part of the approved architecture. To be deleted before this branch
// merges. Reuses the existing token minter and HTTP client unmodified.
//
// mode=albums&artistId=<id>&storefront=<sf>&offset=<n> — inspect pagination shape
// mode=batchcap&storefront=<sf>&count=<n> — probe max ids= per request

import { getAppleDeveloperToken } from './apple-token.js';
import { appleGet } from '../provider-acquisition/connectors/apple-music/apple-http.js';

export default async function handler(req, res) {
  let token;
  try {
    token = getAppleDeveloperToken();
  } catch (err) {
    return res.status(500).json({ error: 'token mint failed', detail: err.message });
  }

  if (req.query.mode === 'artistsearch') {
    const sf = req.query.storefront || 'us';
    const term = encodeURIComponent(req.query.term || 'Prince');
    const path = `/catalog/${sf}/search?term=${term}&types=artists&limit=5`;
    const result = await appleGet(path, token, { maxRetries: 1 });
    const artists = (result.data?.results?.artists?.data || []).map(a => ({ id: a.id, name: a.attributes?.name }));
    return res.status(200).json({ httpStatus: result.status, ok: result.ok, artists });
  }

  if (req.query.mode === 'albums') {
    const sf = req.query.storefront || 'us';
    const artistId = req.query.artistId;
    const offset = req.query.offset || '0';
    if (!artistId) return res.status(400).json({ error: 'artistId required' });
    const path = `/catalog/${sf}/artists/${artistId}/albums?limit=25&offset=${offset}`;
    const result = await appleGet(path, token, { maxRetries: 1 });
    return res.status(200).json({
      httpStatus: result.status,
      ok: result.ok,
      dataLength: result.data?.data?.length ?? null,
      hasNext: !!result.data?.next,
      next: result.data?.next ?? null,
      meta: result.data?.meta ?? null,
      firstIds: (result.data?.data || []).slice(0, 3).map(a => a.id),
      lastIds: (result.data?.data || []).slice(-3).map(a => a.id),
    });
  }

  if (req.query.mode === 'batchcap') {
    const sf = req.query.storefront || 'us';
    const count = parseInt(req.query.count || '100', 10);
    // Generate a large batch of syntactically-valid but mostly-nonexistent
    // numeric ids plus a handful of real Prince ids known to resolve, to
    // observe how Apple's ids= behaves as N grows (error vs silent cap vs
    // full pass-through).
    const realIds = ['1746833068', '1544303593', '1229320468'];
    const ids = [...realIds];
    for (let i = ids.length; i < count; i++) ids.push(String(2000000000 + i));
    const idsParam = encodeURIComponent(ids.join(','));
    const path = `/catalog/${sf}/albums?ids=${idsParam}`;
    const result = await appleGet(path, token, { maxRetries: 1 });
    return res.status(200).json({
      requestedCount: ids.length,
      httpStatus: result.status,
      ok: result.ok,
      dataLength: result.data?.data?.length ?? null,
      returnedRealIds: (result.data?.data || []).map(a => a.id).filter(id => realIds.includes(id)),
      errors: result.data?.errors ?? null,
      rawBodySample: typeof result.rawText === 'string' ? result.rawText.slice(0, 800) : null,
    });
  }

  return res.status(400).json({ error: 'mode=albums or mode=batchcap required' });
}
