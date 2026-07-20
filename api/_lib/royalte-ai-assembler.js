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
// Exported (Phase 2 Recovery, 2026-07-20) so health-intelligence.js can
// distinguish a real positiveSignal/nextAction from the no-data sentinel
// when padding its strengths[]/concerns[] with an AI-derived fallback.
export { UNABLE as UNABLE_INSIGHT_SENTINEL };

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
// Answers: What does this mean?
// Interprets the overall infrastructure state — never enumerates raw
// statistics, counts, scores, or territory lists. Those exist elsewhere.

function deriveObservation(identity, publishing, catalog, gmf) {
  const parts = [];

  // Lead with identity state: the foundation of all other intelligence
  if (identity) {
    const verified = safeNum(identity.verifiedProviders);
    const total    = safeNum(identity.totalProviders);
    const coverage = identity.coverage != null ? safeNum(identity.coverage) / 100 : (total > 0 ? verified / total : 0);
    const hasPubStrengths = publishing && Array.isArray(publishing.strengths) && publishing.strengths.length > 0;

    if (coverage >= 0.8 && hasPubStrengths) {
      parts.push('This artist demonstrates a mature independent infrastructure with verified platform identity and active publishing engagement');
    } else if (coverage >= 0.8) {
      parts.push('Platform identity is verified and consistent — the foundation of a professionally managed independent catalog');
    } else if (coverage >= 0.5) {
      parts.push('Core platform identity is established with opportunities remaining to complete coverage across all reviewed sources');
    } else if (verified > 0) {
      parts.push('Platform identity is partially confirmed, leaving attribution gaps that should be resolved before catalog scale increases');
    } else {
      parts.push('Platform identity could not be confirmed from reviewed sources, which creates uncertainty around attribution and discoverability');
    }
  }

  // Add distribution interpretation (state, never counts)
  if (gmf) {
    const conf   = safeStr(gmf.confidence);
    const status = safeStr(gmf.status);
    if (conf === 'Verified' && status === 'Global') {
      parts.push('catalog distribution is verified at a global scale');
    } else if (conf === 'Verified' && (status === 'Limited' || status === 'Regional')) {
      parts.push('catalog availability is concentrated rather than global, which may affect passive discovery and revenue capture in some markets');
    } else if (conf === 'Not Found') {
      parts.push('global catalog distribution could not be confirmed from reviewed sources');
    }
  }

  if (parts.length === 0) return UNABLE;
  return parts.slice(0, 2).join('. ') + '.';
}

// ─── Priority ─────────────────────────────────────────────────────────
//
// Answers: Why does it matter?
// States the consequence of the highest-priority gap — never names the
// raw issue label or cites statistics. Stakes-first language only.

function derivePriority(identity, publishing, catalog, gmf) {
  // Publishing gaps carry the highest royalty consequence
  if (publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0) {
    const issue = publishing.issues[0];
    const label = safeStr(issue.label || issue.title).toLowerCase();
    if (label.includes('iswc') || label.includes('registration') || label.includes('pro')) {
      return 'Composition registrations could not be confirmed in reviewed sources — compositions not confirmed in active publishing systems may be unable to collect performance royalties.';
    }
    if (label.includes('mlc') || label.includes('mechanical')) {
      return 'Mechanical royalties require active registration to be captured — streaming revenue accrues without collection when this is absent.';
    }
    if (label.includes('publisher') || label.includes('ownership')) {
      return 'Publishing ownership that is unconfirmed in official sources cannot be enforced or monetized in a dispute.';
    }
    return 'Publishing governance gaps are the highest-risk infrastructure issue: attribution and royalty eligibility depend on them.';
  }

  // Territory limitation = uncollected revenue
  if (gmf && (safeStr(gmf.status) === 'Limited' || safeStr(gmf.status) === 'Regional')) {
    return 'Catalog unavailable in a market is revenue not collected in that market — regardless of listener demand.';
  }

  // Identity gaps = attribution risk downstream
  if (identity && Array.isArray(identity.issues) && identity.issues.length > 0) {
    return 'Unresolved identity inconsistencies create downstream risk to attribution, discovery algorithm eligibility, and rights management.';
  }

  // Catalog unconfirmed
  if (catalog && safeStr(catalog.confidence) === 'Unable to Confirm') {
    return 'Catalog data could not be confirmed — which makes it impossible to assess delivery completeness or identify missing works.';
  }

  // No critical gaps found — reframe around the monitoring risk
  return 'With core infrastructure verified, the most significant risk is change over time — gaps that emerge silently as the catalog evolves.';
}

// ─── Priority Label ───────────────────────────────────────────────────
//
// Short 2-3 word label mirroring derivePriority's branching exactly.
// Used by the Executive Assessment™ to label the priority area without
// embedding a full sentence in the display.

function derivePriorityLabel(identity, publishing, catalog, gmf) {
  if (publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0) {
    const issue = publishing.issues[0];
    const label = safeStr(issue.label || issue.title).toLowerCase();
    if (label.includes('iswc') || label.includes('registration') || label.includes('pro')) {
      return 'Rights Registration';
    }
    if (label.includes('mlc') || label.includes('mechanical')) {
      return 'Mechanical Royalties';
    }
    if (label.includes('publisher') || label.includes('ownership')) {
      return 'Publishing Ownership';
    }
    return 'Publishing Governance';
  }
  if (gmf && (safeStr(gmf.status) === 'Limited' || safeStr(gmf.status) === 'Regional')) {
    return 'Territory Reach';
  }
  if (identity && Array.isArray(identity.issues) && identity.issues.length > 0) {
    return 'Identity Consistency';
  }
  if (catalog && safeStr(catalog.confidence) === 'Unable to Confirm') {
    return 'Catalog Confirmation';
  }
  return 'Infrastructure Review';
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
    const verified = safeNum(identity.verifiedProviders);
    const total    = safeNum(identity.totalProviders);
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
// Answers: What should happen next?
// Strategic direction only — never a tactical task list, never a
// restatement of the gap already named in derivePriority.

function deriveNextAction(identity, publishing, catalog, gmf) {
  const hasPubGap  = publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0;
  const hasIdGap   = identity && Array.isArray(identity.issues) && identity.issues.length > 0;
  const isLimited  = gmf && (safeStr(gmf.status) === 'Limited' || safeStr(gmf.status) === 'Regional');
  const isGlobal   = gmf && safeStr(gmf.status) === 'Global';

  if (hasPubGap) {
    return 'Prioritize publishing governance — completing registration infrastructure now protects every future release in addition to the existing catalog.';
  }

  if (isLimited && hasIdGap) {
    return 'Address identity consistency first, then coordinate territory expansion with a distributor — the two are most effective when resolved in sequence.';
  }

  if (isLimited) {
    return 'Territory expansion should be approached strategically with a distributor, prioritizing markets aligned with existing audience reach.';
  }

  if (hasIdGap) {
    return 'Completing platform identity verification protects attribution continuity as the catalog grows and new releases introduce additional surface area.';
  }

  if (isGlobal) {
    return 'The foundation is strong. Establishing continuous infrastructure monitoring ensures any future changes to identity, publishing, or catalog status are detected before they compound.';
  }

  return 'Establish continuous monitoring across identity, publishing, and catalog status — the infrastructure that exists today will evolve, and visibility into those changes is what protects long-term value.';
}

// ─── Executive Insight ────────────────────────────────────────────────
//
// Synthesized 3-sentence paragraph for the Page 1 AI Insight™ hero card.
// Narrative arc: state → reframe the real challenge → direction.
// Never cites statistics, counts, scores, or territory lists.
// This field exists at the Executive Intelligence layer — not the
// observation layer. It answers all three questions in sequence:
// (1) What does this mean? (2) Why does it matter? (3) What's next?

function deriveExecutiveInsight(identity, publishing, catalog, gmf) {
  const sentences = [];

  // (1) What does this mean? — interpret the overall state
  if (identity) {
    const verified       = safeNum(identity.verifiedProviders);
    const total          = safeNum(identity.totalProviders);
    const coverage       = identity.coverage != null ? safeNum(identity.coverage) / 100 : (total > 0 ? verified / total : 0);
    const hasPubStrength = publishing && Array.isArray(publishing.strengths) && publishing.strengths.length > 0;
    const hasPubGap      = publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0;

    if (coverage >= 0.8 && hasPubStrength && !hasPubGap) {
      sentences.push('This infrastructure demonstrates a mature independent operation — identity verified, catalog accessible, and publishing actively engaged.');
    } else if (coverage >= 0.8 && hasPubGap) {
      sentences.push('This infrastructure demonstrates strong platform identity and catalog integrity, with publishing governance representing the primary area requiring attention.');
    } else if (coverage >= 0.8) {
      sentences.push('Platform identity is verified and catalog presence is established — the core signals of a professionally managed independent artist infrastructure.');
    } else if (coverage >= 0.5) {
      sentences.push('Core infrastructure is in place across primary platforms, with meaningful opportunities remaining to complete coverage and strengthen governance.');
    } else {
      sentences.push('The infrastructure is in a formative stage, with significant governance and identity work available to establish a verifiable long-term foundation.');
    }
  } else {
    sentences.push('The infrastructure state could not be fully assessed from reviewed sources.');
  }

  // (2) Why does it matter? — reframe the real challenge
  const hasPubGap = publishing && Array.isArray(publishing.issues) && publishing.issues.length > 0;
  const isLimited = gmf && (safeStr(gmf.status) === 'Limited' || safeStr(gmf.status) === 'Regional');
  const hasIdGap  = identity && Array.isArray(identity.issues) && identity.issues.length > 0;
  const isGlobal  = gmf && safeStr(gmf.status) === 'Global';

  if (hasPubGap && isLimited) {
    sentences.push('The priority is not distribution — it is governance. Publishing gaps and territory limitations together represent the most significant risk to long-term royalty capture and catalog value.');
  } else if (hasPubGap) {
    sentences.push('The largest opportunity is not discovery — it is governance. Completed publishing registrations are what translate streams and placements into collected royalties.');
  } else if (isLimited) {
    sentences.push('The next frontier is not discovery — it is reach. Catalog available only in select markets leaves passive revenue and audience potential on the table.');
  } else if (hasIdGap) {
    sentences.push('The next priority is not visibility — it is consistency. Unresolved identity gaps create compounding risk as releases accumulate and the catalog becomes harder to trace.');
  } else if (isGlobal) {
    sentences.push('The next phase is not expansion — it is protection. With strong infrastructure in place, the risk shifts from what is missing to what could change without notice.');
  } else {
    sentences.push('The next phase is not discovery — it is protection. Infrastructure that exists today will evolve, and visibility into those changes is what preserves long-term value.');
  }

  // (3) What should happen next? — strategic direction
  sentences.push('Establishing continuous monitoring across identity, publishing, catalog status, and territory availability ensures future changes are detected before they affect visibility, attribution, or royalty collection.');

  return sentences.join(' ');
}

// ─── Confidence ───────────────────────────────────────────────────────

function deriveConfidence(identity, publishing, catalog, gmf) {
  let verified = 0;
  if (identity  && safeNum(identity.verifiedProviders)   > 0) verified += 1;
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
      observation:      deriveObservation(identity, publishing, catalog, gmf),
      priority:         derivePriority(identity, publishing, catalog, gmf),
      priorityLabel:    derivePriorityLabel(identity, publishing, catalog, gmf),
      positiveSignal:   derivePositiveSignal(identity, publishing, catalog, gmf),
      nextAction:       deriveNextAction(identity, publishing, catalog, gmf),
      executiveInsight: deriveExecutiveInsight(identity, publishing, catalog, gmf),
      confidence:       deriveConfidence(identity, publishing, catalog, gmf),
      generatedBy:      'engine_template',
      generatedAt:      new Date().toISOString(),
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
