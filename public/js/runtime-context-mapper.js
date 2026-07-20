// ROYALTE RUNTIME CONTEXT MAPPER - v1.0
//
// Single authoritative transformation from raw scan payload to
// royalte_workspace_context schema v1.1.
//
// This is the ONLY place where:
//   - top-level vs payload.canonical field aliases are resolved
//   - field names are normalized (e.g. healthHeadline -> headline)
//   - null is promoted to canonical empty objects (e.g. first-scan monitoring)
//
// Rules:
//   Never invents values.
//   Never makes workspace-specific assumptions.
//   Preserves null when data is legitimately unavailable.
//   Workspaces receive one stable shape -- never need to know payload paths.
//
// Usage (browser):
//   window.buildWorkspaceRuntimeContext(payload, musicRightsProfile, derivedState)
//
// Usage (Node -- tests):
//   const { buildWorkspaceRuntimeContext } = require('./runtime-context-mapper.js');

// Supports both browser (IIFE sets window.buildWorkspaceRuntimeContext)
// and Node.js (module.exports populated for tests).
(function () {
  'use strict';

  // -- Internal: resolve top-level vs canonical alias -----------------------
  // Production scan API aliases only identityIntelligence and publishingIntelligence
  // to top-level. Everything else lives under payload.canonical.*
  // Supabase-stored payloads store canonical fields directly at payload.*.
  // This resolver handles both paths transparently.
  function _r(primary, fallback) {
    return (primary != null) ? primary : (fallback != null ? fallback : null);
  }

  // -- Executive Brief normalizer ------------------------------------------
  // Engine shape:  { briefVersion, generatedAt, executiveSummary, healthHeadline,
  //                  executiveNarrative, topStrengths, priorityActions, ... }
  // Stable shape:  { artistName, headline, executiveSummary, executiveNarrative,
  //                  healthGrade, healthScore, priorityActions, strengths,
  //                  opportunities, risks, generatedAt, briefVersion }
  //
  // Normalization decisions (one field name, no workspace fallback chains):
  //   healthHeadline -> headline
  //   topStrengths   -> strengths
  //   artistName     <- subject.artistName (injected by mapper)
  //   healthGrade    <- healthScore.overallGrade (from healthScore domain)
  //   healthScore    <- healthScore.overallScore (from healthScore domain)
  function _normalizeExecutiveBrief(raw, subjectArtistName, hs) {
    if (!raw) return null;
    return {
      artistName:         subjectArtistName                                            || null,
      headline:           raw.healthHeadline         || raw.headline                  || null,
      executiveSummary:   raw.executiveSummary                                        || null,
      executiveNarrative: raw.executiveNarrative                                      || null,
      healthGrade:        (hs && hs.overallGrade)    || raw.healthGrade              || null,
      healthScore:        (hs && hs.overallScore != null) ? hs.overallScore          : null,
      priorityActions:    Array.isArray(raw.priorityActions)  ? raw.priorityActions   : [],
      strengths:          Array.isArray(raw.topStrengths)     ? raw.topStrengths      :
                          Array.isArray(raw.strengths)        ? raw.strengths         : [],
      opportunities:      Array.isArray(raw.opportunities)    ? raw.opportunities     : [],
      risks:              Array.isArray(raw.risks)             ? raw.risks             : [],
      generatedAt:        raw.generatedAt                                              || null,
      briefVersion:       raw.briefVersion                                             || null,
    };
  }

  // -- Monitoring normalizer ------------------------------------------------
  // null from engine on first scan -> baseline object.
  // Workspace can read mi.status without a null check.
  // When the engine eventually provides first-scan monitoring data, this
  // passthrough returns it unchanged.
  //
  // Workspace baseline detection: mi.status === 'baseline' && mi.scanNumber <= 1
  function _normalizeMonitoring(raw, scanId) {
    if (raw) return raw;
    return {
      status:             'baseline',
      scanNumber:         1,
      baselineEstablished: true,
      previousScanId:     null,
      currentScanId:      scanId || null,
      events:             [],
      newThisScan:        0,
      generatedAt:        null,
    };
  }

  // -- Main mapper ----------------------------------------------------------
  /**
   * buildWorkspaceRuntimeContext(payload, musicRightsProfile, derivedState)
   *
   * @param {Object}      payload            - Raw scan API response
   * @param {Object|null} musicRightsProfile - User configuration (may be absent)
   * @param {Object}      derivedState       - MC-computed values:
   *                        artistName:  string|null
   *                        artwork:     string|null (getBestVerifiedArtistImage result)
   *                        recordLabel: string|null (_appleRecordLabel)
   * @returns {Object} royalte_workspace_context v1.1
   */
  function buildWorkspaceRuntimeContext(payload, musicRightsProfile, derivedState) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('runtime-context-mapper: payload must be an object');
    }
    var can = payload.canonical || {};
    var sub = _r(payload.subject, can.subject) || {};
    var hs  = _r(payload.healthScore,   can.healthScore)   || null;
    var ebRaw = _r(payload.executiveBrief, can.executiveBrief) || null;
    var ds  = derivedState || {};

    return {
      schemaVersion:          '1.1',
      scanId:                 payload.scanId                                                      || null,
      generatedAt:            new Date().toISOString(),
      scannedAt:              _r(payload.scannedAt,              can.scannedAt)                  || null,

      // MC-derived fields (computed from payload by __mcPopulate before calling mapper)
      artistName:             ds.artistName                                                       || null,
      artwork:                ds.artwork                                                          || null,
      recordLabel:            ds.recordLabel                                                      || null,

      // Identity objects -- three distinct responsibilities:
      //   subject:              artist + release identity (name, label, track info)
      //   identity:             CIM provider coverage (from cim.identity)
      //   identityIntelligence: engine-computed coverage report
      subject:                _r(payload.subject,                can.subject)                    || null,
      identity:               _r(payload.cim  && payload.cim.identity,
                                 can.cim && can.cim.identity)                                    || null,
      identityIntelligence:   _r(payload.identityIntelligence,   can.identityIntelligence)      || null,

      // User configuration -- absent until artist completes onboarding
      musicRightsProfile:     musicRightsProfile                                                  || null,

      // Intelligence domains -- engine-produced, all nullable
      // publishing:             CIM-native (from cim.publishing) -- Phase 2 Recovery,
      //                          Publishing Intelligence workspace reads this directly.
      // publishingIntelligence: CimAdapter-bridged (identical value) -- retained for
      //                          other workspaces (e.g. AI Insights) not yet recovered.
      publishing:              _r(payload.cim  && payload.cim.publishing,
                                 can.cim && can.cim.publishing)                                  || null,
      publishingIntelligence: _r(payload.publishingIntelligence, can.publishingIntelligence)     || null,
      catalogIntelligence:    _r(payload.catalogIntelligence,    can.catalogIntelligence)        || null,
      // verification:         CIM-native (from cim.verification, the CIM's real key
      //                       for backend/verification data) -- Phase 2 Recovery,
      //                       Backend Intelligence workspace reads this directly.
      verification:            _r(payload.cim  && payload.cim.verification,
                                 can.cim && can.cim.verification)                                || null,
      backendIntelligence:    _r(payload.backendIntelligence,    can.backendIntelligence)        || null,
      // globalFootprint:      CIM-native (from cim.globalFootprint, the CIM's
      //                       real key name) -- Phase 2 Recovery, Global Music
      //                       Footprint workspace reads this directly.
      globalFootprint:         _r(payload.cim  && payload.cim.globalFootprint,
                                 can.cim && can.cim.globalFootprint)                              || null,
      globalMusicFootprint:   _r(payload.globalMusicFootprint,   can.globalMusicFootprint)       || null,

      // Monitoring -- null from engine on first scan -> normalized to baseline object
      monitoringIntelligence: _normalizeMonitoring(
                                _r(payload.monitoringIntelligence, can.monitoringIntelligence),
                                payload.scanId),

      // Health
      healthIntelligence:     _r(payload.healthIntelligence,     can.healthIntelligence)         || null,
      healthReport:           _r(payload.healthReport,           can.healthReport)                || null,
      healthScore:            hs,

      // AI / Executive -- executiveBrief normalized to stable field names
      royalteAI:              _r(payload.royalteAI,              can.royalteAI)                  || null,
      executiveBrief:         _normalizeExecutiveBrief(ebRaw, sub.artistName, hs),

      // Supplemental
      metrics:                _r(payload.metrics,                can.metrics)                     || null,
      catalog:                _r(payload.catalog,                can.catalog)                     || null,
    };
  }

  // Browser: expose as global
  if (typeof window !== 'undefined') {
    window.buildWorkspaceRuntimeContext = buildWorkspaceRuntimeContext;
  }
  // Node.js: export for tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.buildWorkspaceRuntimeContext = buildWorkspaceRuntimeContext;
  }
}());
