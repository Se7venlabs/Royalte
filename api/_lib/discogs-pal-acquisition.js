// Discogs PAL Acquisition — Phase 3.6
//
// Routes all Discogs evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct calls to getDiscogs(artistName) in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow into runRIE({ evidencePackages }) via combined evidence array.
//
// Auth guard: if DISCOGS_CONSUMER_KEY or DISCOGS_CONSUMER_SECRET is absent,
// acquireDiscogsEvidence returns immediately — treated as AUTH_UNAVAILABLE, not a coverage gap.
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY   — search by name; identity-lock; extract discogsArtistId
//   B. RELEASES          — fetch releases for confirmed artist (requires discogsArtistId from A)

import { ProviderAcquisitionLayer } from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { DiscogsConnector, PROVIDER_NAME as DISCOGS_PROVIDER }
  from '../../provider-acquisition/connectors/discogs/DiscogsConnector.js';
import { createEvidenceRequest }    from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }               from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Discogs artist ID extraction ──────────────────────────────────────────────
//
// Discogs search returns: { results: [{ id, type, title, thumb, uri, resource_url }] }
// Discogs direct lookup returns: { id, name, profile, urls, images, ... }
//
// Identity-lock pattern: exact name match required (2026-06-05 directive).
function extractDiscogsArtistId(contract, artistName) {
  const payload = contract?.payload;
  if (!payload || typeof payload !== 'object') return null;

  // Direct artist lookup (discogsArtistId was already known)
  if (typeof payload.id === 'number' || typeof payload.id === 'string') {
    return String(payload.id);
  }

  // Search result — identity-lock with exact name match
  const norm    = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target  = norm(artistName);
  const results = Array.isArray(payload.results) ? payload.results : [];
  // Discogs artist names may have disambiguation suffixes like "David Bowie (2)"
  // Accept exact match first, then match where base name (before parenthetical) matches
  const exact = results.find(r => norm(r.title) === target) ?? null;
  if (exact) return String(exact.id);

  // No match
  return null;
}

// ── Artist data extraction for compat shape ──────────────────────────────────

function extractArtistData(contract, artistName) {
  const payload = contract?.payload;
  if (!payload) return null;

  // Direct lookup shape
  if (typeof payload.id !== 'undefined' && typeof payload.name === 'string') {
    return { id: payload.id, title: payload.name };
  }

  // Search result shape — find identity-locked result
  const norm    = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target  = norm(artistName);
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.find(r => norm(r.title) === target) ?? null;
}

/**
 * Acquire Discogs evidence via PAL for a single scan.
 *
 * Bails immediately when credentials are absent (AUTH_UNAVAILABLE — not a coverage gap).
 *
 * @param {{ artistName: string, discogsArtistId?: string|null }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireDiscogsEvidence({ artistName, discogsArtistId = null }) {
  const startMs = Date.now();

  const consumerKey    = process.env.DISCOGS_CONSUMER_KEY    ?? null;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET ?? null;

  if (!consumerKey || !consumerSecret) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  if (!artistName && !discogsArtistId) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const evidencePackages = [];

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new DiscogsConnector(), { consumerKey, consumerSecret });
  } catch (err) {
    console.error('[discogs-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    const baseSubjectRef = discogsArtistId
      ? { discogsArtistId, artistName }
      : { artistName };

    // ── A: ARTIST_IDENTITY ───────────────────────────────────────────────────
    const identityReport = await pal.acquire(DISCOGS_PROVIDER, createEvidenceRequest({
      subjectRef:   baseSubjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    const resolvedId = discogsArtistId ?? extractDiscogsArtistId(identityReport.contract, artistName);
    if (!resolvedId) {
      if (artistName) {
        console.log(`[discogs-pal] no exact-match artist for "${artistName}" — skipping enrichment`);
      }
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const enrichedSubjectRef = { ...baseSubjectRef, discogsArtistId: resolvedId };

    // ── B: RELEASES ──────────────────────────────────────────────────────────
    const releasesReport = await pal.acquire(DISCOGS_PROVIDER, createEvidenceRequest({
      subjectRef:   enrichedSubjectRef,
      evidenceType: Capability.RELEASES,
    }));
    evidencePackages.push({ evidenceType: Capability.RELEASES, contract: releasesReport.contract });

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[discogs-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[discogs-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy Discogs compat shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Returns { found, artistId, name, releases, link } — same shape as getDiscogs().
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} [artistName]
 * @returns {{ found: boolean, artistId: number|null, name: string|null, releases: number, link: string|null }}
 */
export function synthesizeDiscogsCompat(evidencePackages, artistName = '') {
  if (!Array.isArray(evidencePackages) || evidencePackages.length === 0) {
    return { found: false, artistId: null, name: null, releases: 0, link: null };
  }

  const identityPkg = evidencePackages.find(p => p.evidenceType === Capability.ARTIST_IDENTITY);
  if (!identityPkg || identityPkg.contract.completeness === 'empty') {
    return { found: false, artistId: null, name: null, releases: 0, link: null };
  }

  const artist = extractArtistData(identityPkg.contract, artistName);
  if (!artist) {
    return { found: false, artistId: null, name: null, releases: 0, link: null };
  }

  const artistId = artist.id ? Number(artist.id) : null;
  const name     = artist.title ?? artist.name ?? null;

  // Extract total release count from RELEASES pagination
  const releasesPkg = evidencePackages.find(p => p.evidenceType === Capability.RELEASES);
  const totalReleases = releasesPkg?.contract?.payload?.pagination?.items ?? 0;

  return {
    found:    true,
    artistId,
    name,
    releases: totalReleases,
    link:     artistId ? `https://www.discogs.com/artist/${artistId}` : null,
  };
}
