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
//   RESOLVED (Phase 2 Recovery, 2026-07-20, Board Option 3 — see
//   governance/adr/ADR-002-CIO-Scope.md): assembleCatalogIntelligence no
//   longer receives canonicalForEnrichment. It now receives a Canonical
//   Catalog Evidence object (api/_lib/catalog-evidence.js) — a sibling
//   canonical object, normalized once, holding no business logic. The
//   CIO itself was not expanded; Catalog Intelligence retains sole
//   ownership of all classification/threshold decisions.
//
//   RESOLVED (Phase 2 Recovery, 2026-07-20, same Board Option 3):
//   assembleBackendIntelligence no longer receives canonicalForEnrichment
//   either. It now receives a Canonical Backend Evidence object
//   (api/_lib/backend-evidence.js) — four scalar availability/timestamp
//   values, same sibling-object pattern as Catalog. Backend Intelligence
//   retains sole ownership of state resolution, labels, and counts.
//
//   RESOLVED (Phase 2 Recovery, 2026-07-20, same Board Option 3):
//   assembleGlobalMusicFootprint no longer receives canonicalForEnrichment
//   either. It now receives a Canonical Global Footprint Evidence object
//   (api/_lib/global-footprint-evidence.js) — Apple availability plus the
//   legacy storefront-fallback shape. territoryIntelligence (its other
//   evidence input) was never part of this bypass and is unchanged — it
//   already reads raw evidencePackages directly by deliberate Board
//   design since Phase 5.2. This closed 3 of the original certified
//   CIO bypasses from governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md
//   and governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md.
//
//   RESOLVED (Phase 2 Recovery, 2026-07-21, Board Option B — see
//   governance/RECORDING_INTELLIGENCE_ARCHITECTURE_REVIEW.md and
//   governance/adr/ADR-002-CIO-Scope.md): assembleRecordingIntelligence
//   (added later, Phase 3.7, the one instance the 2026-07-20 recovery
//   program's target list missed) no longer receives canonicalForEnrichment
//   either. It now receives a Canonical Recording Evidence object
//   (api/_lib/recording-evidence.js) — artistName, spotifyTopTracks,
//   musicbrainzRecordings. This closes the 4th and final CIO-bypass
//   finding (N4); ADR-002 is now fully resolved.

import { assembleCio, validateCio }     from '../../api/_lib/cio-assembler.js';
import { runIntelligenceEngine }         from '../../api/_lib/intelligence-engine.js';
import { ALL_RULES }                     from '../../api/rules/index.js';
import { assembleIdentityIntelligence }  from '../../api/_lib/identity-intelligence.js';
import { assemblePublishingIntelligence } from '../../api/_lib/publishing-intelligence.js';
import { assembleCatalogIntelligence }   from '../../api/_lib/catalog-intelligence.js';
import { assembleCatalogEvidence }       from '../../api/_lib/catalog-evidence.js';
import { assembleGlobalMusicFootprint }  from '../../api/_lib/global-music-footprint.js';
import { assembleGlobalFootprintEvidence } from '../../api/_lib/global-footprint-evidence.js';
// Phase 5.2 — Territory Intelligence Engine™: sole authoritative source of
// territory intelligence. Unlike assembleCatalogIntelligence/
// assembleGlobalMusicFootprint/assembleBackendIntelligence above (documented
// "Known Phase 3 violations" receiving canonicalForEnrichment), this
// assembler consumes evidencePackages directly — raw PAL evidence only,
// per Board decision. It does not repeat that violation pattern.
import { assembleTerritoryIntelligence } from '../../api/_lib/territory-intelligence.js';
import { assembleBackendIntelligence }   from '../../api/_lib/backend-intelligence.js';
import { assembleBackendEvidence }       from '../../api/_lib/backend-evidence.js';
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
// Phase 3.7 — Recording Intelligence Foundation™
import { assembleRecordingIntelligence } from '../recording/recording-intelligence.js';
import { assembleRecordingEvidence }     from '../../api/_lib/recording-evidence.js';

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
  recordingIntelligence,
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

  // §8.2.13 recording{} — Recording Intelligence™ (Phase 3.7 Board Extension)
  cim.recording = recordingIntelligence ?? null;

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

// ── PAL evidence merge — hybrid merge for all PAL providers ──────────────────
// Merges PAL evidence (bridged canonical) into the legacy canonical.
// Phase 2.4: Apple Music authoritative for platforms.appleMusic.*, subject, source.
// Phase 3.6: Spotify authoritative for platforms.spotify.* when PAL evidence present.
// All other legacy canonical fields are preserved.
function _mergeApplePalEvidence(legacyCanonical, bridged) {
  let merged = { ...legacyCanonical };

  // subject — Apple-canonical identity takes precedence for name / ids
  if (bridged.subject && typeof bridged.subject === 'object') {
    merged.subject = { ...legacyCanonical.subject, ...bridged.subject };
  }

  // platforms.appleMusic — PAL is authoritative; deep-merge so existing keys survive
  if (bridged.platforms?.appleMusic) {
    merged.platforms = {
      ...(merged.platforms ?? legacyCanonical.platforms),
      appleMusic: _deepMerge(
        legacyCanonical.platforms?.appleMusic ?? {},
        bridged.platforms.appleMusic
      ),
    };
  }

  // platforms.spotify — PAL is authoritative when Spotify PAL evidence present (Phase 3.6)
  if (bridged.platforms?.spotify) {
    const currentPlatforms = merged.platforms ?? legacyCanonical.platforms ?? {};
    merged.platforms = {
      ...currentPlatforms,
      spotify: _deepMerge(
        currentPlatforms.spotify ?? {},
        bridged.platforms.spotify
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

    // ── CIO structural gate (Board Directive, Platform Recovery Phase 1) ──
    // validateCio() previously had zero production callers — a malformed
    // CIO could silently reach the Intelligence Engine and every domain
    // assembler. Symmetric with the invalid-evidencePackages gate above:
    // an invalid CIO short-circuits to a safe, degraded CIM rather than
    // propagating malformed data downstream.
    const { valid: cioValid, errors: cioErrors } = validateCio(cio);
    if (!cioValid) {
      console.error('[rie] runRIE: invalid CIO —', cioErrors.join('; '));
      const ts    = now();
      const empty = emptyCIM();
      empty.scanAuthority = { _cimVersion: CIM_VERSION, generatedAt: ts, error: 'invalid_cio', details: cioErrors };
      return certifyCIM(empty, { generatedAt: ts });
    }

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
  // Phase 2 Recovery (Board Option 3, 2026-07-20): Catalog Intelligence no
  // longer reads canonicalForEnrichment directly. assembleCatalogEvidence()
  // normalizes the relevant fields into a sibling canonical object first --
  // CIO bypass resolved without duplicating data into the CIO or moving
  // classification logic into the CIO assembler. See catalog-evidence.js
  // and governance/adr/ADR-002-CIO-Scope.md.
  const catalogEvidence = assembleCatalogEvidence(canonicalForEnrichment);
  try { catalogIntelligence = assembleCatalogIntelligence(report, cio, catalogEvidence); }
  catch (e) { console.error('[rie] Catalog Intelligence failed:', e.message); }

  // Phase 5.2 — Territory Intelligence Engine™: consumes raw evidencePackages
  // directly (PAL evidence only), not canonicalForEnrichment. Sole
  // authoritative source of territory intelligence; Global Music Footprint
  // below is now a consumer of this output, not an independent calculator.
  let territoryIntelligence = null;
  try { territoryIntelligence = assembleTerritoryIntelligence(evidencePackages); }
  catch (e) { console.error('[rie] Territory Intelligence failed:', e.message); }

  let globalMusicFootprint = null;
  // Phase 2 Recovery (Board Option 3, 2026-07-20): Global Music Footprint no
  // longer reads canonicalForEnrichment directly for the Apple availability
  // scalar / legacy storefront fallback. territoryIntelligence (4th arg) is
  // unchanged -- it was never part of this bypass; see global-footprint-evidence.js.
  const globalFootprintEvidence = assembleGlobalFootprintEvidence(canonicalForEnrichment);
  try { globalMusicFootprint = assembleGlobalMusicFootprint(report, cio, globalFootprintEvidence, territoryIntelligence); }
  catch (e) { console.error('[rie] Global Music Footprint failed:', e.message); }

  let backendIntelligence = null;
  // Phase 2 Recovery (Board Option 3, 2026-07-20): Backend Intelligence no
  // longer reads canonicalForEnrichment directly. Same pattern as Catalog
  // Intelligence's recovery -- see backend-evidence.js and
  // governance/adr/ADR-002-CIO-Scope.md.
  const backendEvidence = assembleBackendEvidence(canonicalForEnrichment);
  try { backendIntelligence = assembleBackendIntelligence(backendEvidence, publishingIntelligence); }
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

  // Phase 3.7 — Recording Intelligence™ domain assembler
  // Phase 2 Recovery (Board Option B, 2026-07-21 — Recording Intelligence
  // Alignment): Recording Intelligence no longer reads canonicalForEnrichment
  // directly. Same Option-3/Option-B sibling-evidence-object pattern as
  // Catalog/Backend/Global Music Footprint above -- see recording-evidence.js
  // and governance/adr/ADR-002-CIO-Scope.md. This closes the 4th and final
  // instance of the original N4 finding.
  const recordingEvidence = assembleRecordingEvidence(canonicalForEnrichment);
  let recordingIntelligence = null;
  try { recordingIntelligence = assembleRecordingIntelligence(recordingEvidence); }
  catch (e) { console.error('[rie] Recording Intelligence failed:', e.message); }

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
    recordingIntelligence,
    report,
    executiveBrief,
    royalteAI,
    lineage,
    artistName,
    now: () => ts,
  });

  return certifyCIM(cim, { generatedAt: ts });
}
