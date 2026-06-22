// ─────────────────────────────────────────────────────────────────────
//  Royaltē AI™ — Assembler (Phase Royaltē AI v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓
//    Domain assemblers: Identity, Publishing, Catalog, GMF
//        ↓
//    Royaltē AI™ Assembler  ◀── THIS MODULE
//        ↓
//    audit_scans.payload.royalteAI
//        ↓
//    Mission Control™ · Royaltē AI card
//
//  Canonical Payload V2 Object 10 mapping:
//    Persisted key:  'royalteAI' (operative brief Phase Royaltē AI v1.0)
//    generatedBy:    'engine_template' (deterministic — no LLM, no I/O)
//    observation    ≈ Constitution's summary
//    nextAction     ≈ Constitution's recommendation
//    priority       + positiveSignal are refinements beyond the base spec
//
//  Core invariants:
//    - Reads ONLY assembled intelligence objects; never raw scan data
//    - Never calls any provider API; never calls an LLM
//    - Never invents facts absent from the assembled intelligence
//    - UNABLE_TO_CONFIRM inputs → 'Unable to generate insight' outputs
//    - Deterministic: identical inputs produce identical outputs
//    - Output is deep-frozen
//
//  Purity invariants:
//    - Pure function of (identityIntelligence, publishingIntelligence,
//                        catalogIntelligence, globalMusicFootprint).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      observation:    string,   // primary overall finding (≤2 sentences)
//      priority:       string,   // highest-priority gap requiring attention
//      positiveSignal: string,   // strongest verified success signal
//      nextAction:     string,   // single actionable recommended step
//      confidence:     'high' | 'medium' | 'low',
//      generatedBy:    'engine_template',
//      generatedAt:    string,   // ISO timestamp
//      generatedFrom:  string[], // which modules contributed non-null data
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const ROYALTE_AI_VERSION = '1.0.0';

const UNABLE = 'Unable to generate insight from reviewed sources.';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function safeObj(x) {
  return (x && typeof x === 'object' && !Array.isArray(x)) ? x : null;
}

function safeNum(x) {
  return (typeof x === 'number' && Number.isFinite(x)) ? x : 0;
}

function safeStr(x) {
  return typeof x === 'string' ? x : '';
}

// ─── Observation ──────────────────────────────────────────────────────
//
// 1-2 sentences synthesised from the strongest verified signals across
// modules. Only VERIFIED or confidence-confirmed data contributes.

function deriveObservation(identity, publishing, catalog, gmf) {
  const parts = [];

  if (gmf) {
    const conf   = safeStr(gmf.confidence);
    const status = safeStr(gmf.status);
    const count  = safeNum(gmf.territoriesAvailable);
    if (conf === 'Verified' && status === 'Global' && count > 0) {
      parts.push(`Your catalog is verified globally across all ${count} Apple Music territories`);
    } else if (conf === 'Verified' && count > 0) {
      parts.push(`Your catalog is available in ${count} Apple Music territories`);
    }
  }

  if (catalog) {
    const tracks  = safeNum(catalog.totalTracks);
    const albums  = safeNum(catalog.albums);
    const eps     = safeNum(catalog.eps);
    const singles = safeNum(catalog.singles);
    const conf    = safeStr(catalog.confidence);
    if (conf !== 'Unable to Confirm' && tracks > 0) {
      const items = [];
      if (albums  > 0) items.push(`${albums} album${albums !== 1 ? 's' : ''}`);
      if (eps     > 0) items.push(`${eps} EP${eps !== 1 ? 's' : ''}`);
      if (singles > 0) items.push(`${singles} single${singles !== 1 ? 's' : ''}`);
      if (items.length > 0) {
        parts.push(`Your catalog includes ${items.join(', ')}`);
      } else {
        parts.push(`${tracks} track${tracks !== 1 ? 's' : ''} verified in your catalog`);
      }
    }
  }

  if (identity) {
    const verified = safeNum(identity.verified);
    const total    = safeNum(identity.total);
    if (verified > 0 && total > 0) {
      parts.push(
        `Identity is verified across ${verified} of ${total} reviewed platform${total !== 1 ? 's' : ''}`
      );
    }
  }

  if (parts.length === 0) return UNABLE;
  return parts.slice(0, 2).join('. ') + '.';
}

// ─── Priority ─────────────────────────────────────────────────────────
//
// Highest-priority gap from issues arrays. Publishing checked first
// (most common source of actionable gaps), then identity, then catalog,
// then GMF. UNABLE_TO_CONFIRM is informational — never a priority gap.

function derivePriority(identity, publishing, catalog, gmf) {
  if (publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0) {
    const top   = publishing.issues[0];
    const title = safeStr(top.title);
    if (title) return title;
    const label = safeStr(top.label);
    if (label) return `${label} has not been confirmed in reviewed sources.`;
  }

  if (identity && Array.isArray(identity.issues) && identity.issues.length > 0) {
    const title = safeStr(identity.issues[0].title);
    if (title) return title;
  }

  if (catalog) {
    const conf   = safeStr(catalog.confidence);
    const status = safeStr(catalog.catalogStatus);
    if (conf === 'Unable to Confirm') {
      return 'Catalog data could not be determined from reviewed sources.';
    }
    if (status === 'Unable to Confirm') {
      return 'Catalog classification could not be determined from reviewed sources.';
    }
  }

  if (gmf) {
    const conf   = safeStr(gmf.confidence);
    const status = safeStr(gmf.status);
    if (conf === 'Not Found') {
      return 'Global distribution could not be confirmed from reviewed sources.';
    }
    if (status === 'Limited') {
      return 'Global music distribution is limited. Review territory coverage with your distributor.';
    }
  }

  return 'No critical issues detected in reviewed sources.';
}

// ─── Positive Signal ──────────────────────────────────────────────────
//
// Strongest verified success signal. GMF Global is the top priority
// (widest reach), then identity coverage, then publishing strengths,
// then catalog size. UNABLE_TO_CONFIRM data never becomes a signal.

function derivePositiveSignal(identity, publishing, catalog, gmf) {
  if (gmf) {
    const conf   = safeStr(gmf.confidence);
    const status = safeStr(gmf.status);
    const count  = safeNum(gmf.territoriesAvailable);
    if (conf === 'Verified' && status === 'Global' && count > 0) {
      return `Verified global distribution across all ${count} Apple Music territories.`;
    }
    if (conf === 'Verified' && count > 0) {
      return `Distribution verified in ${count} Apple Music territories.`;
    }
  }

  if (identity) {
    const verified = safeNum(identity.verified);
    const total    = safeNum(identity.total);
    if (verified > 0 && verified === total && total > 1) {
      return `Identity fully verified across all ${total} reviewed platforms.`;
    }
    if (verified > 0 && total > 0) {
      return `Identity verified across ${verified} of ${total} reviewed platform${total !== 1 ? 's' : ''}.`;
    }
  }

  if (publishing && Array.isArray(publishing.strengths) && publishing.strengths.length > 0) {
    const labels = publishing.strengths
      .map((s) => safeStr(s.label))
      .filter(Boolean);
    if (labels.length > 0) {
      return `Publishing verified: ${labels.slice(0, 2).join(', ')}.`;
    }
  }

  if (catalog) {
    const tracks = safeNum(catalog.totalTracks);
    const conf   = safeStr(catalog.confidence);
    if (conf !== 'Unable to Confirm' && tracks > 0) {
      return `${tracks} track${tracks !== 1 ? 's' : ''} verified in your Apple Music catalog.`;
    }
  }

  return 'Unable to identify verified positive signals from reviewed sources.';
}

// ─── Next Action ──────────────────────────────────────────────────────
//
// Single recommended step. Reads from recommendations arrays first.
// Falls back to issue-driven heuristics only when no recommendation
// exists. Never invents a recommendation unsupported by the assembled data.

function deriveNextAction(identity, publishing, catalog, gmf) {
  if (publishing && Array.isArray(publishing.recommendations) && publishing.recommendations.length > 0) {
    const rec = safeStr(publishing.recommendations[0].recommendation);
    if (rec) return rec;
  }

  // Issue-driven heuristics when no recommendation was emitted
  if (publishing && publishing.registrations) {
    const r = publishing.registrations;
    if (r.publisherInformation === 'NOT_FOUND') {
      return 'Register with a music publisher or establish self-publishing to confirm publisher information.';
    }
    if (r.iswcCoverage === 'NOT_FOUND' || r.iswcCoverage === 'ACTION_REQUIRED') {
      return 'Complete ISWC registration for your catalog works through your PRO or a registration service.';
    }
    if (r.writerCredits === 'ACTION_REQUIRED') {
      return 'Complete writer attribution and IPI number registration for all credited works.';
    }
    if (r.mlcRegistration === 'NOT_FOUND') {
      return 'Register your works with the MLC to ensure digital performance royalty collection.';
    }
  }

  if (identity && Array.isArray(identity.recommendations) && identity.recommendations.length > 0) {
    const rec = safeStr(identity.recommendations[0].recommendation);
    if (rec) return rec;
  }

  if (gmf) {
    const status = safeStr(gmf.status);
    if (status === 'Limited' || status === 'Regional') {
      return 'Review your distribution agreements to expand territory coverage across additional markets.';
    }
  }

  return 'No immediate actions required. Schedule a rescan to monitor for future changes.';
}

// ─── Confidence ───────────────────────────────────────────────────────

function deriveConfidence(identity, publishing, catalog, gmf) {
  let verified = 0;
  if (identity  && safeNum(identity.verified)            > 0) verified += 1;
  if (publishing && safeNum(publishing.registeredCount)  > 0) verified += 1;
  if (catalog    && safeStr(catalog.confidence)  === 'Verified') verified += 1;
  if (gmf        && safeStr(gmf.confidence)      === 'Verified') verified += 1;
  if (verified >= 3) return 'high';
  if (verified >= 1) return 'medium';
  return 'low';
}

// ─── Public API ──────────────────────────────────────────────────────

export function assembleRoyalteAI(
  identityIntelligence,
  publishingIntelligence,
  catalogIntelligence,
  globalMusicFootprint
) {
  try {
    const identity   = safeObj(identityIntelligence);
    const publishing = safeObj(publishingIntelligence);
    const catalog    = safeObj(catalogIntelligence);
    const gmf        = safeObj(globalMusicFootprint);

    const generatedFrom = [];
    if (identity)   generatedFrom.push('identityIntelligence');
    if (publishing) generatedFrom.push('publishingIntelligence');
    if (catalog)    generatedFrom.push('catalogIntelligence');
    if (gmf)        generatedFrom.push('globalMusicFootprint');

    if (generatedFrom.length === 0) {
      return deepFreeze({
        observation:    UNABLE,
        priority:       UNABLE,
        positiveSignal: UNABLE,
        nextAction:     UNABLE,
        confidence:     'low',
        generatedBy:    'engine_template',
        generatedAt:    new Date().toISOString(),
        generatedFrom:  [],
      });
    }

    return deepFreeze({
      observation:    deriveObservation(identity, publishing, catalog, gmf),
      priority:       derivePriority(identity, publishing, catalog, gmf),
      positiveSignal: derivePositiveSignal(identity, publishing, catalog, gmf),
      nextAction:     deriveNextAction(identity, publishing, catalog, gmf),
      confidence:     deriveConfidence(identity, publishing, catalog, gmf),
      generatedBy:    'engine_template',
      generatedAt:    new Date().toISOString(),
      generatedFrom,
    });
  } catch (err) {
    console.error('[royalte-ai-assembler] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      observation:    UNABLE,
      priority:       UNABLE,
      positiveSignal: UNABLE,
      nextAction:     UNABLE,
      confidence:     'low',
      generatedBy:    'engine_template',
      generatedAt:    new Date().toISOString(),
      generatedFrom:  [],
    });
  }
}
