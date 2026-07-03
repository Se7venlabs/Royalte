// MLC PAL Acquisition — Phase 3.6 (The MLC)
//
// Routes all MLC evidence acquisition through the Provider Acquisition Layer.
// First MLC provider integration in run-scan.js — no legacy direct-call to replace.
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow into runRIE({ evidencePackages }) via combined evidence array.
//
// Auth guard: if MLC_USERNAME or MLC_PASSWORD is absent, acquireMLCEvidence returns
// immediately — treated as AUTH_UNAVAILABLE, not a coverage gap.
//
// Sequential acquisition order:
//   A. ISRC (POST /search/recordings)
//      Search recordings by artist name → extract mlcSongCodes.
//      API endpoint requires no auth; connector requires active session.
//
//   B. PUBLISHING (POST /works)
//      Full work details (publishers, writers, ISWC, AKAs) for resolved mlcSongCodes.
//      Skipped when A returns no matched song codes or auth unavailable.
//
// Evidence preservation:
//   Raw Recording[] and Work[] payloads are preserved in Evidence Contracts.
//   Downstream intelligence domains consume normalized evidence via EvidenceBridge.
//   Normalization is NOT performed here — that boundary belongs to the intelligence domain.

import { ProviderAcquisitionLayer } from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { MLCConnector, PROVIDER_NAME as MLC_PROVIDER }
  from '../../provider-acquisition/connectors/mlc/MLCConnector.js';
import { createEvidenceRequest }    from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }               from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Song code extraction ───────────────────────────────────────────────────────
//
// /search/recordings response: [{ id, title, artist, isrc, mlcsongCode, labels }]
// Note: the API uses `mlcsongCode` (lowercase 's') in the recording response.
// We deduplicate and filter nulls.
function extractMlcSongCodes(contract) {
  const payload = contract?.payload;
  if (!Array.isArray(payload) || payload.length === 0) return [];

  const codes = payload
    .map(r => r?.mlcsongCode ?? null)
    .filter(code => typeof code === 'string' && code.trim().length > 0);

  // Deduplicate — same work may be linked to multiple recordings
  return [...new Set(codes)];
}

/**
 * Acquire MLC evidence via PAL for a single scan.
 *
 * Bails immediately when credentials are absent (AUTH_UNAVAILABLE — not a coverage gap).
 *
 * @param {{ artistName: string }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireMLCEvidence({ artistName }) {
  const startMs = Date.now();

  const username = process.env.MLC_USERNAME ?? null;
  const password = process.env.MLC_PASSWORD ?? null;

  if (!username || !password) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const evidencePackages = [];

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new MLCConnector(), { username, password });
  } catch (err) {
    console.error('[mlc-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    // ── A: ISRC — recording search ────────────────────────────────────────────
    // Search recordings registered with The MLC for this artist.
    // Returns Recording[]: [{ id, title, artist, isrc, mlcsongCode, labels }]
    const recordingReport = await pal.acquire(MLC_PROVIDER, createEvidenceRequest({
      subjectRef:   { artistName },
      evidenceType: Capability.ISRC,
    }));
    evidencePackages.push({ evidenceType: Capability.ISRC, contract: recordingReport.contract });

    const mlcSongCodes = extractMlcSongCodes(recordingReport.contract);

    if (mlcSongCodes.length === 0) {
      console.log(`[mlc-pal] no MLC recordings found for "${artistName}" — skipping work lookup`);
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    // ── B: PUBLISHING — work details ──────────────────────────────────────────
    // Fetch full work objects for all matched song codes.
    // Returns Work[]: [{ primaryTitle, mlcSongCode, iswc, writers, publishers, akas, artists }]
    const worksReport = await pal.acquire(MLC_PROVIDER, createEvidenceRequest({
      subjectRef:   { artistName, mlcSongCodes },
      evidenceType: Capability.PUBLISHING,
    }));
    evidencePackages.push({ evidenceType: Capability.PUBLISHING, contract: worksReport.contract });

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[mlc-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[mlc-pal] shutdown error:', e.message));
  }
}
