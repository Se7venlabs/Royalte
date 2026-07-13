// ─────────────────────────────────────────────────────────────────────────────
// ROYALTĒ MISSION CONTROL™ — RUNTIME CONTEXT CONTRACT v1.2
//
// Architectural rules (Board-locked 2026-07-13):
//   ONE source of truth.  MC writes it.  Workspaces read it.
//   Workspaces are pure renderers — they receive context and render.
//   If context is absent or invalid → show "No scan loaded."
//   Never fall back to demo data.  Never source data independently.
//
// Runtime flow:
//   Scan → Canonical Payload → buildWorkspaceRuntimeContext() → __mcPopulate()
//                                   → royalte_workspace_context
//                                              ↓
//                                   readWorkspaceContext({ contract: '...' })
//                                              ↓
//                                      Workspace renderer
//
// WORKSPACE CONTRACT REGISTRY:
//   Each workspace references a named contract from WORKSPACE_CONTRACTS below.
//   The registry is the authoritative source of required domains + required fields.
//   Workspaces pass { contract: 'workspace-name' } — they do not enumerate
//   field paths themselves.
//
// State enum: 'valid' | 'missing' | 'invalid' | 'expired' | 'missing_domain' | 'missing_field'
//   Workspaces treat all non-'valid' states identically: show overlay, stop.
//   The distinction exists for diagnostics and future tooling only.
//
// Every workspace loads this file before its wiring script.
// SCHEMA_VERSION must match the value written by buildWorkspaceRuntimeContext().
// ─────────────────────────────────────────────────────────────────────────────

(function (global) {
  'use strict';

  var SCHEMA_VERSION = '1.1';
  var MAX_AGE_MS     = 4 * 60 * 60 * 1000;
  var STORAGE_KEY    = 'royalte_workspace_context';

  // ── Workspace Contract Registry ────────────────────────────────────────────
  // required:       domain keys that must be non-null for the workspace to render
  // requiredFields: dot-path fields that must be non-null within those domains
  // optional:       documented for completeness — absence does not fail contract
  var WORKSPACE_CONTRACTS = {
    'health-intelligence': {
      required:       ['healthIntelligence'],
      requiredFields: [],
      optional:       ['healthScore', 'healthReport'],
    },
    'identity-intelligence': {
      required:       ['subject', 'identity'],
      requiredFields: ['subject.artistName'],
      optional:       ['identityIntelligence', 'metrics', 'artwork'],
    },
    'publishing-intelligence': {
      required:       ['publishingIntelligence'],
      requiredFields: [],
      optional:       ['musicRightsProfile', 'recordLabel'],
    },
    'catalog-intelligence': {
      required:       ['catalogIntelligence'],
      requiredFields: ['catalogIntelligence.totalTracks'],
      optional:       ['catalogIntelligence.isrcCoverage', 'catalogIntelligence.bestVerifiedRelease'],
    },
    'backend-intelligence': {
      required:       ['backendIntelligence'],
      requiredFields: ['backendIntelligence.services'],
      optional:       ['backendIntelligence.apisResponding'],
    },
    'global-music-footprint': {
      required:       ['globalMusicFootprint'],
      requiredFields: ['globalMusicFootprint.status', 'globalMusicFootprint.territoriesAvailable'],
      optional:       ['globalMusicFootprint.reachNarrative'],
    },
    'monitoring-timeline': {
      // monitoringIntelligence is always produced by the mapper (baseline when first scan)
      required:       [],
      requiredFields: [],
      optional:       ['monitoringIntelligence', 'healthIntelligence'],
    },
    'ai-insights': {
      required:       ['executiveBrief'],
      requiredFields: ['executiveBrief.headline'],
      optional:       ['royalteAI', 'healthScore'],
    },
  };

  // ── Field path resolver ────────────────────────────────────────────────────
  function _getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return null;
      cur = cur[parts[i]];
    }
    return (cur !== undefined) ? cur : null;
  }

  // ── Schema validator ───────────────────────────────────────────────────────
  function validate(obj) {
    if (!obj || typeof obj !== 'object') {
      return { state: 'missing', ctx: null, reason: 'context is null or non-object' };
    }
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      return {
        state:  'invalid',
        ctx:    null,
        reason: 'schemaVersion mismatch — got "' + obj.schemaVersion + '", expected "' + SCHEMA_VERSION + '"',
      };
    }
    var artistName = (obj.subject && obj.subject.artistName) || obj.artistName || null;
    if (!artistName) {
      return { state: 'invalid', ctx: null, reason: 'artistName absent from context' };
    }
    if (obj.generatedAt) {
      var age = Date.now() - new Date(obj.generatedAt).getTime();
      if (age > MAX_AGE_MS) {
        return {
          state:  'expired',
          ctx:    obj,
          reason: 'context is ' + Math.round(age / 60000) + 'm old (max ' + (MAX_AGE_MS / 60000) + 'm)',
        };
      }
    }
    return { state: 'valid', ctx: obj, reason: null };
  }

  // ── Context reader ─────────────────────────────────────────────────────────
  /**
   * Read royalte_workspace_context, validate, and enforce workspace contract.
   *
   * @param {Object} [options]
   * @param {string} [options.contract]  Named contract from WORKSPACE_CONTRACTS registry.
   *   Preferred. Enforces both required domains and required field paths.
   * @param {string[]} [options.required]  Legacy: array of domain keys that must be non-null.
   *   Supported for backward compatibility. Does not check field paths.
   *
   * @returns {{ state, ctx, reason, missingDomains?, missingFields? }}
   *
   * State values:
   *   'valid'          — context present, schema valid, not expired, contract satisfied
   *   'missing'        — no context in sessionStorage
   *   'invalid'        — schema version mismatch or artistName absent
   *   'expired'        — context older than MAX_AGE_MS
   *   'missing_domain' — a required top-level domain is absent from this scan
   *   'missing_field'  — a required field within a domain is absent from this scan
   */
  function readWorkspaceContext(options) {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { state: 'missing', ctx: null, reason: 'key absent from sessionStorage' };
      }
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) {
        return { state: 'invalid', ctx: null, reason: 'JSON parse error: ' + e.message };
      }
      var result = validate(parsed);
      if (result.state !== 'valid') return result;

      // ── Contract enforcement ───────────────────────────────────────────────
      if (options && options.contract) {
        var contract = WORKSPACE_CONTRACTS[options.contract];
        if (!contract) {
          return {
            state:  'invalid',
            ctx:    result.ctx,
            reason: 'unknown workspace contract: "' + options.contract + '"',
          };
        }
        // 1. Required domain check
        var absentDomains = (contract.required || []).filter(function (d) {
          return result.ctx[d] == null;
        });
        if (absentDomains.length > 0) {
          return {
            state:          'missing_domain',
            ctx:            result.ctx,
            reason:         'required domains absent: ' + absentDomains.join(', '),
            missingDomains: absentDomains,
          };
        }
        // 2. Required field check (dot-path resolution)
        var absentFields = (contract.requiredFields || []).filter(function (path) {
          return _getPath(result.ctx, path) == null;
        });
        if (absentFields.length > 0) {
          return {
            state:         'missing_field',
            ctx:           result.ctx,
            reason:        'required fields absent: ' + absentFields.join(', '),
            missingFields: absentFields,
          };
        }
        return result;
      }

      // ── Legacy required-domain list ────────────────────────────────────────
      if (options && Array.isArray(options.required) && options.required.length > 0) {
        var absent = options.required.filter(function (d) { return result.ctx[d] == null; });
        if (absent.length > 0) {
          return {
            state:          'missing_domain',
            ctx:            result.ctx,
            reason:         'required domains absent from this scan: ' + absent.join(', '),
            missingDomains: absent,
          };
        }
      }

      return result;
    } catch (e) {
      return { state: 'invalid', ctx: null, reason: 'sessionStorage read error: ' + e.message };
    }
  }

  global.RoyalteContext = {
    SCHEMA_VERSION:      SCHEMA_VERSION,
    MAX_AGE_MS:          MAX_AGE_MS,
    STORAGE_KEY:         STORAGE_KEY,
    WORKSPACE_CONTRACTS: WORKSPACE_CONTRACTS,
    validate:            validate,
    readWorkspaceContext: readWorkspaceContext,
  };

}(window));
