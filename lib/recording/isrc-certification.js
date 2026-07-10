// Royaltē Recording Intelligence™ — ISRC Certification Engine
//
// For each CanonicalRecording, compares ISRCs across all contributing
// sources and produces a certification status.
//
// Status vocabulary (Board Directive 2026-07-01):
//
//   VERIFIED         — 2+ independent sources agree on the same ISRC
//   CONFLICT         — sources disagree (different ISRCs for the same title)
//   SINGLE_SOURCE    — only one source provided an ISRC (not corroborated)
//   UNABLE_TO_CONFIRM — no source provided an ISRC
//
// Adds { certificationStatus, certifiedISRC, isrcConflicts } to each recording.
// Pure. No I/O. Never throws.

// countSourcesPerIsrc: maps each unique ISRC to the list of sources that reported it
function countSourcesPerIsrc(sourceEvidence) {
  const byIsrc = new Map(); // isrc → Set<source>
  for (const ev of sourceEvidence) {
    if (!ev.isrc) continue;
    const isrc = ev.isrc.trim().toUpperCase();
    if (!byIsrc.has(isrc)) byIsrc.set(isrc, new Set());
    byIsrc.get(isrc).add(ev.source);
  }
  return byIsrc;
}

export function certifyISRCs(canonicalRecordings) {
  if (!Array.isArray(canonicalRecordings)) return [];

  return canonicalRecordings.map(rec => {
    const evidence = rec.sourceEvidence ?? [];
    const byIsrc   = countSourcesPerIsrc(evidence);

    let certificationStatus;
    let certifiedISRC    = null;
    let isrcConflicts    = [];

    if (byIsrc.size === 0) {
      // No source reported an ISRC
      certificationStatus = 'UNABLE_TO_CONFIRM';

    } else if (byIsrc.size === 1) {
      // Exactly one unique ISRC across all sources
      const [[isrc, sources]] = [...byIsrc.entries()];
      certifiedISRC = isrc;
      certificationStatus = sources.size >= 2 ? 'VERIFIED' : 'SINGLE_SOURCE';

    } else {
      // Multiple distinct ISRCs — conflict
      certificationStatus = 'CONFLICT';
      isrcConflicts = [...byIsrc.entries()].map(([isrc, sources]) => ({
        isrc,
        sources:     [...sources],
        sourceCount: sources.size,
      }));
      // Best-effort certified ISRC: prefer the one from the most sources,
      // tiebreak by Apple (canonical authority)
      const sorted = isrcConflicts.slice().sort((a, b) => {
        if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
        return a.sources.includes('apple') ? -1 : 1;
      });
      certifiedISRC = sorted[0]?.isrc ?? null;
    }

    return Object.freeze({
      ...rec,
      certificationStatus,
      certifiedISRC,
      isrcConflicts: Object.freeze(isrcConflicts),
    });
  });
}
