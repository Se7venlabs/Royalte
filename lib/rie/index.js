// Royaltē Intelligence Engine™ (RIE) — Layer 2 Entrypoint
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Phase 1 Board Authorization: 2026-07-01
//
// "No Product Owns Intelligence."
//   Products present intelligence.
//   The RIE produces it. Only the RIE.
//
// ── Seven RIE Responsibilities (v1.3 §3.3) ───────────────────────
//
//   1. Collect   — accept evidence from the Provider Acquisition Layer
//   2. Validate  — confirm evidence is well-formed and trustworthy
//   3. Reconcile — resolve provider conflicts (Apple = identity anchor)
//   4. Normalize — map provider shapes to canonical shapes
//   5. Enrich    — derive intelligence not present in any single provider
//   6. Compute   — produce scores, findings, risks, recommendations
//   7. Certify   — stamp output as canonical, versioned, consumable
//
// ── Layer 2 Components (existing locked modules) ──────────────────
//
//   cio-assembler.js          → steps 4-5 (normalize + enrich)
//   intelligence-engine.js    → step 6  (compute — rule execution)
//   health-engine.js          → step 6  (compute — health score)
//   executive-brief-engine.js → step 6  (compute — executive language)
//   identity-intelligence.js  → step 6  (compute — identity domain)
//   publishing-intelligence.js → step 6 (compute — publishing domain)
//   catalog-intelligence.js   → step 6  (compute — catalog domain)
//   global-music-footprint.js → step 6  (compute — territorial domain)
//   backend-intelligence.js   → step 6  (compute — verification domain)
//   health-intelligence.js    → step 6  (compute — health interpretation)
//   royalte-ai-assembler.js   → step 6  (compute — AI insight)
//   identity-graph.js         → step 5  (enrich — publishing relationships)
//   reconciliation/identity-anchor.js → step 3 (reconcile — Apple rule)
//   certify.js                → step 7  (certify)
//
// ── Phase 1 Scope ────────────────────────────────────────────────
//
//   Phase 1 establishes the RIE as a formal service. Existing locked
//   Layer 2 components are wrapped here without altering their contracts.
//   The output is the 12-object Canonical Intelligence Model (§8.2).
//
//   audit.js orchestration is NOT changed in Phase 1 — it still calls
//   the assembly chain directly. Phase 4 rewires audit.js to call
//   runRIE() instead.
//
//   Evidence input in Phase 1: canonicalForEnrichment (the normalized
//   AuditResponse from normalizeAuditResponse.js). Phase 2 will replace
//   this with raw PAL adapter outputs; the output contract (CIM) is
//   unchanged.
//
//   Known Phase 3 violations carried forward intentionally (strangler
//   pattern — legacy paths identified, isolated here, retired in Phase 3):
//     • assembleCatalogIntelligence receives canonicalForEnrichment
//     • assembleGlobalMusicFootprint receives canonicalForEnrichment
//     • assembleBackendIntelligence receives canonicalForEnrichment
//   These violations are now contained within Layer 2 (the RIE).
//   They are not new violations; they are existing violations that
//   Phase 3 will resolve by moving normalization fully into the engine.

import { assembleCio }                  from '../../api/_lib/cio-assembler.js';
import { runIntelligenceEngine }         from '../../api/_lib/intelligence-engine.js';
import { ALL_RULES }                     from '../../api/rules/index.js';
import { assembleIdentityIntelligence }  from '../../api/_lib/identity-intelligence.js';
import { assemblePublishingIntelligence } from '../../api/_lib/publishing-intelligence.js';
import { assembleCatalogIntelligence }   from '../../api/_lib/catalog-intelligence.js';
import { assembleGlobalMusicFootprint }  from '../../api/_lib/global-music-footprint.js';
import { assembleBackendIntelligence }   from '../../api/_lib/backend-intelligence.js';
import { assembleRoyalteAI }             from '../../api/_lib/royalte-ai-assembler.js';
import { assembleHealthIntelligence }    from '../../api/_lib/health-intelligence.js';
import { computeHealthScore, generateHealthReport } from '../../api/_lib/health-engine.js';
import { generateExecutiveBrief }        from '../../api/_lib/executive-brief-engine.js';
import { applyIdentityAnchor }           from './reconciliation/identity-anchor.js';
import { certifyCIM }                    from './certify.js';
import { emptyCIM, CIM_VERSION }         from '../../api/schema/canonical-intelligence-model.js';
// Phase 2.4 — PAL input path activated at the Phase 1 extension point.
import { randomUUID }                    from 'node:crypto';
import { validateEvidencePackages }      from './EvidenceValidator.js';
import { bridgeToCanonical, extractEvidenceLineage } from './EvidenceBridge.js';

// RIE version stamp for scanAuthority evidence lineage (Board directive, Phase 2.4).
const RIE_VERSION = '1.0.0';

// ── assembleCIM ──────────────────────────────────────────────────
//
// Maps the outputs of the Layer 2 assembly chain to the 12-object CIM.
// This is the normalization step that converts domain assembler outputs
// into the constitutional canonical shape.
//
// Exported for direct use in tests (exit-gate verification).
export function assembleCIM({
  canonicalForEnrichment,
  identityIntelligence,
  healthScore,
  healthReport,
  healthIntelligence,
  globalMusicFootprint,
  catalogIntelligence,
  backendIntelligence,
  publishingIntelligence,
  report,
  executiveBrief,
  royalteAI,
  lineage = null,  // Phase 2.4 — evidence lineage from EvidenceBridge (null for Phase 1 path)
  artistName,
  now,
}) {
  const cim = emptyCIM();
  const ts  = now ? now() : new Date().toISOString();

  // §8.2 identity{} — identity intelligence from the assembly chain
  cim.identity = identityIntelligence ?? null;

  // §8.2 health{} — unified health object (score + grade + categories + report)
  // Three separate objects (healthScore, healthReport, healthIntelligence) are
  // unified here into one constitutional object.
  //
  // Board Directive (One Health Engine): cim.health.score is the sole
  // authoritative health score. V2 health engine retired. All consumers
  // read from cim.health exclusively.
  if (healthIntelligence || healthScore) {
    cim.health = {
      // Core score (Phase 7 Health Engine — sole authority)
      score:             healthIntelligence?.score            ?? healthScore?.overallScore  ?? null,
      grade:             healthScore?.overallGrade            ?? null,    // letter: A+/A/B/C/D/F
      status:            healthIntelligence?.status           ?? null,    // Excellent/Strong/Moderate/Needs Review
      summary:           healthScore?.summary                 ?? null,    // Board-locked prose
      // Domain confidence and breakdown
      confidence:        healthIntelligence?.confidence       ?? null,
      categoryBreakdown: healthScore?.categoryBreakdown       ?? [],      // per-category Phase 7 scores
      // Signals for consumer display (from Health Intelligence assembler)
      concerns:          healthIntelligence?.concerns         ?? [],
      strengths:         healthIntelligence?.strengths        ?? [],
      // Contributor domain scores (display-only — do not drive overallScore)
      identityScore:     healthIntelligence?.identityScore    ?? null,
      publishingScore:   healthIntelligence?.publishingScore  ?? null,
      catalogScore:      healthIntelligence?.catalogScore     ?? null,
      footprintScore:    healthIntelligence?.footprintScore   ?? null,
      backendScore:      healthIntelligence?.backendScore     ?? null,
      monitoringScore:   healthIntelligence?.monitoringScore  ?? null,
      // Full health report for consumers that need it
      report:            healthReport                         ?? null,
    };
  }

  // §8.2 globalFootprint{}
  cim.globalFootprint = globalMusicFootprint ?? null;

  // §8.2 catalog{}
  cim.catalog = catalogIntelligence ?? null;

  // §8.2 verification{} — backend registration status
  // Phase 3 violation note: backendIntelligence currently reads from
  // canonicalForEnrichment.platforms.* directly (see assembly chain).
  // That boundary is fixed in Phase 3.
  cim.verification = backendIntelligence ?? null;

  // §8.2 metadata{} — Phase 1 stub from canonical issues/modules
  // Phase 3 replaces with a dedicated Metadata Intelligence assembler
  // that reads from the CIO, not from canonicalForEnrichment.
  const issues  = canonicalForEnrichment?.issues   ?? {};
  const modules = canonicalForEnrichment?.modules  ?? {};
  cim.metadata = {
    flagCount:    Object.values(issues).filter(Boolean).length,
    flags:        issues,
    moduleStatus: modules,
    _phase1Stub:  true, // replaced in Phase 3
  };

  // §8.2 publishing{}
  cim.publishing = publishingIntelligence ?? null;

  // §8.2 opportunities{} — from Intelligence Engine rule output
  cim.opportunities = report?.opportunities ?? [];

  // §8.2 actions{} — prioritized executive actions from the Brief
  cim.actions = executiveBrief?.priorityActions ?? [];
  // Phase 3.1 migration bridge: full executive brief for backward-compat consumers
  // (render-audit-pdf.js reads healthHeadline, executiveSummary, etc. from the brief).
  // Carried here as _brief until all consumers migrate to CIM-native fields.
  // Retire this field once all products read directly from cim.actions.
  cim.brief = executiveBrief ?? null;

  // §8.2 aiInsight{}
  cim.aiInsight = royalteAI ?? null;

  // §8.2 revenueSignals{} — RESERVED (Revenue Signals™ is a future module)
  cim.revenueSignals = Object.freeze({ status: 'RESERVED', data: null });

  // §8.2 scanAuthority{} — scan provenance
  const appleDetails = canonicalForEnrichment?.platforms?.appleMusic?.details ?? {};
  const anchor       = applyIdentityAnchor(canonicalForEnrichment?.platforms ?? {});
  cim.scanAuthority = {
    _cimVersion:        CIM_VERSION,
    generatedAt:        ts,
    subjectName:        artistName ?? canonicalForEnrichment?.subject?.artistName ?? null,
    subjectId:          appleDetails.artistId ?? null,
    anchorProvider:     anchor._anchor.provider,
    reconciliationRule: anchor._anchor.rule,
    // Phase 2.4 — Board-mandated evidence lineage and CIM versioning metadata.
    // Present only when runRIE is called via the PAL evidence path.
    ...(lineage ? {
      schemaVersion:             '1.0',
      intelligenceEngineVersion: RIE_VERSION,
      sourceProviders:           lineage.sourceProviders,
      evidenceIds:               lineage.evidenceIds,
      connectorVersions:         lineage.connectorVersions,
      certificationId:           randomUUID(),
    } : {}),
  };

  return cim;
}

// ── Apple Production Migration — hybrid evidence merge ────────────────────────
// Merges PAL Apple evidence (bridged canonical) into a legacy canonical.
// PAL is authoritative for platforms.appleMusic.*, subject identity, source.
// All Spotify / other-provider fields from the legacy canonical are preserved.
function _mergeApplePalEvidence(legacyCanonical, bridged) {
  const merged = { ...legacyCanonical };

  // subject — Apple-canonical identity takes precedence for name / ids
  if (bridged.subject && typeof bridged.subject === 'object') {
    merged.subject = { ...legacyCanonical.subject, ...bridged.subject };
  }

  // platforms.appleMusic — PAL is authoritative; deep-merge so existing keys survive
  if (bridged.platforms?.appleMusic) {
    merged.platforms = {
      ...legacyCanonical.platforms,
      appleMusic: _deepMerge(
        legacyCanonical.platforms?.appleMusic ?? {},
        bridged.platforms.appleMusic
      ),
    };
  }

  // source — Apple-canonical source context takes precedence when provided
  if (bridged.source && typeof bridged.source === 'object') {
    merged.source = { ...legacyCanonical.source, ...bridged.source };
  }

  return merged;
}

function _deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = _deepMerge(base[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── runRIE ────────────────────────────────────────────────────────
//
// The sole RIE entrypoint. Accepts provider evidence, runs the full
// assembly chain, maps to the 12-object CIM, and emits a certified,
// deep-frozen Canonical Intelligence Model.
//
// evidence — two accepted shapes:
//
//   Phase 1 (existing):
//     canonicalForEnrichment  AuditResponse  normalized provider evidence
//     publishingWorks         PublishingWork[] | null
//     publishingSourceObservations  object | null
//
//   Phase 2.4 (activated here — PAL input path):
//     evidencePackages        EvidencePackage[]  from the Provider Acquisition Layer
//     publishingWorks         PublishingWork[] | null  (still accepted)
//     publishingSourceObservations  object | null      (still accepted)
//
// options:
//   artistName  string    (falls back to subject.artistName after bridge)
//   now         () => string   injectable clock for deterministic tests
//
// Returns: Promise<frozen CIM>
// Never throws — assembly failures are isolated and result in null CIM objects.
export async function runRIE(evidence, options = {}) {
  const {
    evidencePackages             = null,
    publishingWorks              = null,
    publishingSourceObservations = null,
  } = evidence;

  // canonicalForEnrichment may be replaced by the bridge when evidencePackages are present.
  let canonicalForEnrichment = evidence.canonicalForEnrichment ?? null;

  const now = options.now ?? (() => new Date().toISOString());

  // ── Step 1: Collect ──────────────────────────────────────────
  // Phase 1: evidence arrives as AuditResponse (normalizeAuditResponse output).
  // Phase 2.4: evidence arrives as EvidencePackages from the Provider Acquisition Layer.
  //   EvidenceValidator confirms structural integrity of each Evidence Contract.
  //   EvidenceBridge translates contract payloads into canonicalForEnrichment.
  //   Both paths converge at the identical assembly chain below — one pipeline.
  let lineage = null;
  if (Array.isArray(evidencePackages)) {
    const { valid, errors } = validateEvidencePackages(evidencePackages);
    if (!valid) {
      console.error('[rie] runRIE: invalid evidence packages —', errors.join('; '));
      const ts    = now();
      const empty = emptyCIM();
      empty.scanAuthority = { _cimVersion: CIM_VERSION, generatedAt: ts, error: 'invalid_evidence_packages', details: errors };
      return certifyCIM(empty, { generatedAt: ts });
    }
    const bridged = bridgeToCanonical(evidencePackages);
    lineage = extractEvidenceLineage(evidencePackages);

    if (canonicalForEnrichment && typeof canonicalForEnrichment === 'object') {
      // Hybrid path (Apple Production Migration): PAL evidence provides Apple-specific fields;
      // legacy canonical carries Spotify + all other providers.
      // PAL is authoritative for: subject identity, platforms.appleMusic.*, source.*
      canonicalForEnrichment = _mergeApplePalEvidence(canonicalForEnrichment, bridged);
    } else {
      canonicalForEnrichment = bridged;
    }
  }

  // artistName derived after bridge so the PAL path can fall through to bridged subject.
  const artistName = options.artistName
    ?? canonicalForEnrichment?.subject?.artistName
    ?? '';

  if (!canonicalForEnrichment || typeof canonicalForEnrichment !== 'object') {
    console.error('[rie] runRIE called with missing evidence — returning empty CIM');
    const ts    = now();
    const empty = emptyCIM();
    empty.scanAuthority = { _cimVersion: CIM_VERSION, generatedAt: ts, error: 'missing_evidence' };
    return certifyCIM(empty, { generatedAt: ts });
  }

  // ── Step 2: Validate ─────────────────────────────────────────
  // Confirm the evidence carries a subject reference we can anchor to.
  const hasSubject = !!(
    canonicalForEnrichment.subject?.artistName ||
    canonicalForEnrichment.platforms?.appleMusic?.details?.artistId
  );
  if (!hasSubject) {
    console.warn('[rie] evidence has no identifiable subject — CIM may be sparse');
  }

  // ── Step 3: Reconcile ─────────────────────────────────────────
  // Apple-as-canonical is now a governed rule, not wiring.
  // applyIdentityAnchor produces the reconciled identity evidence used
  // by the CIO assembler and the scanAuthority stamp.
  // Phase 1: receives canonicalForEnrichment.platforms.
  // Phase 2.4: receives bridged platforms from the Evidence Contract payloads.
  applyIdentityAnchor(canonicalForEnrichment.platforms ?? {});

  // ── Steps 4-5: Normalize + Enrich (CIO Assembly) ─────────────
  let cio    = null;
  let report = null;
  try {
    cio = assembleCio(artistName, {
      scanPayload:                  canonicalForEnrichment,
      publishingWorks,
      publishingSourceObservations,
    });
    // ── Step 6: Compute (Intelligence Engine) ──────────────────
    report = runIntelligenceEngine(cio, ALL_RULES);
  } catch (kernelErr) {
    console.error('[rie] CIO/Intelligence Engine failed:', kernelErr.message);
  }

  // ── Step 6: Compute — domain assemblers ──────────────────────
  // Each domain assembler is isolated; one failure does not block others.
  let identityIntelligence = null;
  try { identityIntelligence = assembleIdentityIntelligence(report, cio); }
  catch (e) { console.error('[rie] Identity Intelligence failed:', e.message); }

  let publishingIntelligence = null;
  try { publishingIntelligence = assemblePublishingIntelligence(report, cio); }
  catch (e) { console.error('[rie] Publishing Intelligence failed:', e.message); }

  let catalogIntelligence = null;
  try { catalogIntelligence = assembleCatalogIntelligence(report, cio, canonicalForEnrichment); }
  catch (e) { console.error('[rie] Catalog Intelligence failed:', e.message); }

  let globalMusicFootprint = null;
  try { globalMusicFootprint = assembleGlobalMusicFootprint(report, cio, canonicalForEnrichment); }
  catch (e) { console.error('[rie] Global Music Footprint failed:', e.message); }

  let backendIntelligence = null;
  try { backendIntelligence = assembleBackendIntelligence(canonicalForEnrichment, publishingIntelligence); }
  catch (e) { console.error('[rie] Backend Intelligence failed:', e.message); }

  let royalteAI = null;
  try {
    royalteAI = assembleRoyalteAI(
      identityIntelligence,
      publishingIntelligence,
      catalogIntelligence,
      globalMusicFootprint,
    );
  } catch (e) { console.error('[rie] Royaltē AI failed:', e.message); }

  let healthScore    = null;
  let healthReport   = null;
  let executiveBrief = null;
  try {
    healthScore    = computeHealthScore(report);
    healthReport   = generateHealthReport(cio, report);
    executiveBrief = generateExecutiveBrief(cio, report, healthReport, healthScore);
  } catch (e) { console.error('[rie] Health/Brief pipeline failed:', e.message); }

  let healthIntelligence = null;
  try {
    healthIntelligence = assembleHealthIntelligence(
      healthScore,
      identityIntelligence,
      publishingIntelligence,
      catalogIntelligence,
      globalMusicFootprint,
      backendIntelligence,
      null, // monitoringIntelligence — post-scan, not available here
      royalteAI,
    );
  } catch (e) { console.error('[rie] Health Intelligence failed:', e.message); }

  // ── Step 7: Certify ───────────────────────────────────────────
  const ts  = now();
  const cim = assembleCIM({
    canonicalForEnrichment,
    identityIntelligence,
    healthScore,
    healthReport,
    healthIntelligence,
    globalMusicFootprint,
    catalogIntelligence,
    backendIntelligence,
    publishingIntelligence,
    report,
    executiveBrief,
    royalteAI,
    lineage,
    artistName,
    now: () => ts,
  });

  return certifyCIM(cim, { generatedAt: ts });
}
