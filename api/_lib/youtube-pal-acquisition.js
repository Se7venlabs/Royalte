// YouTube PAL Acquisition — Phase 3.6 (YouTube)
//
// Routes all YouTube evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct calls to getYouTube(artistName) in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow into runRIE({ evidencePackages }) via combined evidence array.
//
// Auth guard: if YOUTUBE_API_KEY is absent, acquireYouTubeEvidence returns immediately
// — treated as AUTH_UNAVAILABLE, not a coverage gap.
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY  — channel search (or direct channelId lookup via Identity Graph)
//                         Identity-lock: exact channelTitle match required
//   B. COLLECTION_DATA  — channel stats, topicDetails, brandingSettings, contentDetails
//                         (requires channelId resolved from step A)

import { ProviderAcquisitionLayer } from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { YouTubeConnector, PROVIDER_NAME as YOUTUBE_PROVIDER }
  from '../../provider-acquisition/connectors/youtube/YouTubeConnector.js';
import { createEvidenceRequest }    from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }               from '../../provider-acquisition/capability/capabilityVocabulary.js';
import { lookupYouTubeChannelId }   from './identity-graph.js';

// ── Channel ID extraction ─────────────────────────────────────────────────────
//
// Two payload shapes returned by the connector:
//
// 1. Search result (ARTIST_IDENTITY via artistName):
//      { items: [{ id: { channelId }, snippet: { channelId, channelTitle } }] }
//
// 2. Direct channel lookup (ARTIST_IDENTITY via channelId):
//      { items: [{ id: "UC...", snippet: { title } }] }
//
// Identity-lock (2026-06-05): exact channelTitle match required for search path.
// Direct lookup by channelId is authoritative — no name match required.
//
// Returns null on no match — silence over wrong identity.
function extractYouTubeChannelId(contract, artistName, channelSource) {
  const payload = contract?.payload;
  if (!payload || typeof payload !== 'object') return null;

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return null;

  // Direct lookup path (channelSource = 'royalte_identity_graph'):
  // channels.list returns { id: "UC..." } — channelId IS the item id.
  if (channelSource === 'royalte_identity_graph') {
    const id = items[0]?.id;
    return typeof id === 'string' && id.startsWith('UC') ? id : null;
  }

  // Search result path — identity-lock on exact channel title match.
  const norm   = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target = norm(artistName);

  const match = items.find(item => norm(item.snippet?.channelTitle) === target) ?? null;
  if (!match) return null;

  // search.list items: id.channelId or snippet.channelId
  return match.id?.channelId ?? match.snippet?.channelId ?? null;
}

// ── Channel title extraction ──────────────────────────────────────────────────

function extractChannelTitle(contract, channelSource) {
  const payload = contract?.payload;
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) return null;

  const item = payload.items[0];
  // channels.list: snippet.title — search.list: snippet.channelTitle
  return item?.snippet?.title ?? item?.snippet?.channelTitle ?? null;
}

/**
 * Acquire YouTube evidence via PAL for a single scan.
 *
 * Bails immediately when YOUTUBE_API_KEY is absent (AUTH_UNAVAILABLE — not a coverage gap).
 *
 * @param {{ artistName: string }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireYouTubeEvidence({ artistName }) {
  const startMs = Date.now();

  const apiKey = process.env.YOUTUBE_API_KEY ?? null;
  if (!apiKey) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const evidencePackages = [];

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new YouTubeConnector(), { apiKey });
  } catch (err) {
    console.error('[youtube-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    // Check Identity Graph for a pre-resolved channelId (read-only per governance).
    const knownChannelId = lookupYouTubeChannelId(artistName);
    const channelSource  = knownChannelId ? 'royalte_identity_graph' : 'strict_name_match';

    const subjectRef = knownChannelId
      ? { artistName, channelId: knownChannelId }
      : { artistName };

    // ── A: ARTIST_IDENTITY ────────────────────────────────────────────────────
    const identityReport = await pal.acquire(YOUTUBE_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    const resolvedChannelId = extractYouTubeChannelId(
      identityReport.contract, artistName, channelSource
    );

    if (!resolvedChannelId) {
      console.log(`[youtube-pal] no exact-match channel for "${artistName}" — skipping enrichment`);
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    // ── B: COLLECTION_DATA ────────────────────────────────────────────────────
    const collectionReport = await pal.acquire(YOUTUBE_PROVIDER, createEvidenceRequest({
      subjectRef:   { artistName, channelId: resolvedChannelId },
      evidenceType: Capability.COLLECTION_DATA,
    }));
    evidencePackages.push({ evidenceType: Capability.COLLECTION_DATA, contract: collectionReport.contract });

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[youtube-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[youtube-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy YouTube compat shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags / estimateRoyaltyGap).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Returns the same shape as the legacy getYouTube():
 *   { found, availability, officialChannel, contentIdVerified, subscriberCount, totalOfficialViews }
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} [artistName]
 * @returns {object}
 */
export function synthesizeYouTubeCompat(evidencePackages, artistName = '') {
  const empty = { found: false, reason: 'no evidence' };

  if (!Array.isArray(evidencePackages) || evidencePackages.length === 0) return empty;

  const identityPkg = evidencePackages.find(p => p.evidenceType === Capability.ARTIST_IDENTITY);
  if (!identityPkg || identityPkg.contract.completeness === 'empty') return empty;

  // Determine channel source from identity payload shape
  const identityPayload = identityPkg.contract?.payload;
  const identityItems   = Array.isArray(identityPayload?.items) ? identityPayload.items : [];

  // Determine if Identity Graph path (items[0].id is a string "UC...") or search path
  const firstId       = identityItems[0]?.id;
  const isGraphPath   = typeof firstId === 'string' && firstId.startsWith('UC');
  const channelSource = isGraphPath ? 'royalte_identity_graph' : 'strict_name_match';

  const resolvedChannelId = extractYouTubeChannelId(identityPkg.contract, artistName, channelSource);
  if (!resolvedChannelId) {
    return { found: false, availability: 'UNVERIFIED', reason: 'no_canonical_channel_match' };
  }

  const channelTitle = extractChannelTitle(identityPkg.contract, channelSource);

  // Collect COLLECTION_DATA evidence for statistics
  const collectionPkg  = evidencePackages.find(p => p.evidenceType === Capability.COLLECTION_DATA);
  const collectionData = collectionPkg?.contract?.payload;
  const channelItem    = Array.isArray(collectionData?.items) ? collectionData.items[0] : null;
  const stats          = channelItem?.statistics ?? {};

  const subscriberCount    = parseInt(stats.subscriberCount ?? 0) || 0;
  const officialViewCount  = parseInt(stats.viewCount       ?? 0) || 0;
  const officialVideoCount = parseInt(stats.videoCount      ?? 0) || 0;

  // Use channel title from COLLECTION_DATA if available (authoritative — channel can rename)
  const resolvedTitle = channelItem?.snippet?.title ?? channelTitle ?? null;

  return {
    found:        true,
    availability: 'VERIFIED',
    officialChannel: {
      title:       resolvedTitle,
      channelId:   resolvedChannelId,
      subscribers: subscriberCount,
      totalViews:  officialViewCount,
      videoCount:  officialVideoCount,
      verifiedVia: channelSource,
    },
    contentIdVerified:  officialViewCount > 0,
    subscriberCount,
    totalOfficialViews: officialViewCount,
  };
}
