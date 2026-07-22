// ROYALTE MISSION CONTROL(TM) -- RUNTIME CONTEXT CONTRACT v1.3
//
// Architectural rules (Board-locked 2026-07-13):
//   ONE source of truth.  MC writes it.  Workspaces read it.
//   Workspaces are pure renderers -- they receive context and render.
//   If context is absent or invalid -> show "No scan loaded."
//   Never fall back to demo data.  Never source data independently.
//
// Runtime flow:
//   Scan -> Canonical Payload -> buildWorkspaceRuntimeContext() -> __mcPopulate()
//                                    -> royalte_workspace_context
//                                               |
//                                   readWorkspaceContext({ contract: '...' })
//                                               |
//                                      Workspace renderer
//
// WORKSPACE CONTRACT REGISTRY:
//   Each workspace references a named contract from WORKSPACE_CONTRACTS below.
//   The registry is the authoritative source of required domains, required fields,
//   and required field types.
//   Workspaces pass { contract: 'workspace-name' } -- they do not enumerate
//   field paths themselves.
//
// State enum:
//   'valid'          -- context present, schema valid, not expired, contract satisfied
//   'missing'        -- no context in sessionStorage
//   'invalid'        -- schema version mismatch or artistName absent
//   'expired'        -- context older than MAX_AGE_MS
//   'missing_domain' -- a required top-level domain is absent from this scan
//   'missing_field'  -- a required field within a domain is absent from this scan
//   'type_mismatch'  -- a required field has wrong type (e.g. services is object not array)
//
// Workspaces treat all non-'valid' states identically: show overlay, stop.
// The distinction exists for diagnostics and future tooling only.
//
// Every workspace loads this file before its wiring script.
// SCHEMA_VERSION must match the value written by buildWorkspaceRuntimeContext().

(function (global) {
  'use strict';

  var SCHEMA_VERSION = '1.1';
  var MAX_AGE_MS     = 4 * 60 * 60 * 1000;
  var STORAGE_KEY    = 'royalte_workspace_context';

  // -- Type check constants --------------------------------------------------
  // Supported expectedType values for requiredTypes map entries:
  //   'string'           typeof === 'string'
  //   'non-empty-string' typeof === 'string' && trim().length > 0
  //   'number'           typeof === 'number' && !isNaN()
  //   'boolean'          typeof === 'boolean'
  //   'array'            Array.isArray()
  //   'object'           typeof === 'object', not null, not array
  function _checkType(value, expectedType) {
    switch (expectedType) {
      case 'string':            return typeof value === 'string';
      case 'non-empty-string':  return typeof value === 'string' && value.trim().length > 0;
      case 'number':            return typeof value === 'number' && !isNaN(value);
      case 'boolean':           return typeof value === 'boolean';
      case 'array':             return Array.isArray(value);
      case 'object':            return value !== null && typeof value === 'object' && !Array.isArray(value);
      default:                  return true;
    }
  }

  function _typeName(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  // -- Workspace Contract Registry ------------------------------------------
  // required:       domain keys that must be non-null for the workspace to render
  // requiredFields: dot-path fields that must be non-null within those domains
  // requiredTypes:  map of dot-path -> expectedType (enforced after presence check)
  // optional:       documented for completeness -- absence does not fail contract
  var WORKSPACE_CONTRACTS = {
    'health-intelligence': {
      required:       ['healthIntelligence'],
      requiredFields: ['healthIntelligence.score', 'healthIntelligence.status'],
      requiredTypes:  {
        'healthIntelligence.score':  'number',
        'healthIntelligence.status': 'non-empty-string',
      },
      optional:       ['healthScore', 'healthReport'],
    },
    'identity-intelligence': {
      required:       ['subject', 'identity'],
      requiredFields: ['subject.artistName', 'identity.providers'],
      requiredTypes:  {
        'subject.artistName':  'non-empty-string',
        'identity.providers':  'object',
      },
      optional:       ['identityIntelligence', 'metrics', 'artwork'],
    },
    'publishing-intelligence': {
      // Phase 2 Recovery (2026-07-20): workspace now reads ctx.publishing
      // (CIM-native) instead of ctx.publishingIntelligence -- contract
      // updated to match what the workspace actually consumes.
      // publishingIntelligence remains populated in the runtime context
      // for ai-insights.html, which is not yet recovered.
      required:       ['publishing'],
      requiredFields: [],
      requiredTypes:  {},
      optional:       ['publishingIntelligence', 'musicRightsProfile', 'recordLabel'],
    },
    'catalog-intelligence': {
      required:       ['catalogIntelligence'],
      requiredFields: ['catalogIntelligence.totalTracks'],
      requiredTypes:  {
        'catalogIntelligence.totalTracks': 'number',
      },
      optional:       ['catalogIntelligence.isrcIntelligence', 'catalogIntelligence.bestVerifiedRelease'],
    },
    'backend-intelligence': {
      // Phase 2 Recovery (2026-07-20): workspace now reads ctx.verification
      // (CIM-native, matching cim.verification's real key name) instead of
      // ctx.backendIntelligence -- contract updated to match. backendIntelligence
      // remains populated in the runtime context for ai-insights.html, which
      // is not yet recovered.
      required:       ['verification'],
      requiredFields: ['verification.services'],
      requiredTypes:  {
        'verification.services': 'array',
      },
      optional:       ['backendIntelligence', 'verification.apisResponding'],
    },
    'global-music-footprint': {
      // Phase 2 Recovery (2026-07-20): workspace (and its gmf-distribution-gaps.js
      // companion script) now read ctx.globalFootprint (CIM-native, matching
      // cim.globalFootprint's real key name) instead of ctx.globalMusicFootprint --
      // contract updated to match. globalMusicFootprint remains populated in the
      // runtime context for ai-insights.html, which is not yet recovered.
      required:       ['globalFootprint'],
      requiredFields: ['globalFootprint.status', 'globalFootprint.territoriesAvailable'],
      requiredTypes:  {
        'globalFootprint.status':               'non-empty-string',
        'globalFootprint.territoriesAvailable': 'number',
      },
      optional:       ['globalMusicFootprint', 'globalFootprint.reachNarrative'],
    },
    'monitoring-timeline': {
      // monitoringIntelligence is always produced by the mapper (baseline when first scan).
      // Monitoring now has a required domain and required fields.
      required:       ['monitoringIntelligence'],
      requiredFields: ['monitoringIntelligence.status', 'monitoringIntelligence.scanNumber', 'monitoringIntelligence.events'],
      requiredTypes:  {
        'monitoringIntelligence.status':     'non-empty-string',
        'monitoringIntelligence.scanNumber': 'number',
        'monitoringIntelligence.events':     'array',
      },
      optional:       ['healthIntelligence'],
    },
    'ai-insights': {
      required:       ['executiveBrief'],
      requiredFields: ['executiveBrief.headline'],
      requiredTypes:  {
        'executiveBrief.headline': 'non-empty-string',
      },
      optional:       ['royalteAI', 'healthScore'],
    },
    'media-intelligence': {
      // Runtime Context Audit (Board directive, 2026-07-21): mediaIntelligence
      // was not yet an official buildWorkspaceRuntimeContext() output field at
      // that time -- no PAL/CIM assembler produced it for any artist, real or
      // fixture-free. Real as of the Media Intelligence™ implementation
      // (Board directive 2026-07-22): cim.media (CIM §8.2.14) is now produced
      // by assembleMediaIntelligence() and threaded through by
      // runtime-context-mapper.js as ctx.mediaIntelligence.
      // Kept optional (not required) -- a scan with no video/social evidence
      // for a given artist is still a VALID context for this workspace to
      // render (as an empty/not-yet-available state, not a missing scan),
      // matching how every other contract in this registry already treats a
      // field that may legitimately be absent (e.g. publishing-intelligence's
      // musicRightsProfile/recordLabel).
      required:       [],
      requiredFields: [],
      requiredTypes:  {},
      optional:       ['mediaIntelligence', 'mediaIntelligence.platformCoverage', 'mediaIntelligence.assetCompleteness', 'mediaIntelligence.contentActivity', 'mediaIntelligence.digitalPresence', 'mediaIntelligence.catalogMediaSupport', 'mediaIntelligence.audienceReach'],
    },
  };

  // -- Field path resolver --------------------------------------------------
  function _getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return null;
      cur = cur[parts[i]];
    }
    return (cur !== undefined) ? cur : null;
  }

  // -- Pure contract validator (testable without sessionStorage) -------------
  /**
   * validateContract(ctx, contractName)
   *
   * Runs required-domain, required-field, and type checks against a pre-parsed
   * context object. Does NOT read sessionStorage.
   *
   * @param {Object} ctx          - Pre-validated context object (schemaVersion already checked)
   * @param {string} contractName - Named contract from WORKSPACE_CONTRACTS
   * @returns {{ state, ctx, reason, missingDomains?, missingFields?, typeMismatches?, workspace? }}
   */
  function validateContract(ctx, contractName) {
    var contract = WORKSPACE_CONTRACTS[contractName];
    if (!contract) {
      return {
        state:  'invalid',
        ctx:    ctx,
        reason: 'unknown workspace contract: "' + contractName + '"',
      };
    }

    // 1. Required domain check
    var absentDomains = (contract.required || []).filter(function (d) {
      return ctx[d] == null;
    });
    if (absentDomains.length > 0) {
      return {
        state:          'missing_domain',
        ctx:            ctx,
        reason:         'required domains absent: ' + absentDomains.join(', '),
        missingDomains: absentDomains,
      };
    }

    // 2. Required field presence check (dot-path resolution)
    var absentFields = (contract.requiredFields || []).filter(function (path) {
      return _getPath(ctx, path) == null;
    });
    if (absentFields.length > 0) {
      return {
        state:         'missing_field',
        ctx:           ctx,
        reason:        'required fields absent: ' + absentFields.join(', '),
        missingFields: absentFields,
      };
    }

    // 3. Required type check
    var types = contract.requiredTypes || {};
    var typeMismatches = [];
    Object.keys(types).forEach(function (path) {
      var val = _getPath(ctx, path);
      // Only type-check fields that are present (absence handled above)
      if (val != null && !_checkType(val, types[path])) {
        typeMismatches.push({
          field:    path,
          expected: types[path],
          received: _typeName(val),
        });
      }
    });
    if (typeMismatches.length > 0) {
      return {
        state:          'type_mismatch',
        ctx:            ctx,
        reason:         'type validation failed: ' + typeMismatches.map(function (m) {
                          return m.field + ' (expected ' + m.expected + ', got ' + m.received + ')';
                        }).join(', '),
        workspace:      contractName,
        typeMismatches: typeMismatches,
      };
    }

    return { state: 'valid', ctx: ctx, reason: null };
  }

  // -- Schema validator (storage-level checks) ------------------------------
  function validate(obj) {
    if (!obj || typeof obj !== 'object') {
      return { state: 'missing', ctx: null, reason: 'context is null or non-object' };
    }
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      return {
        state:  'invalid',
        ctx:    null,
        reason: 'schemaVersion mismatch -- got "' + obj.schemaVersion + '", expected "' + SCHEMA_VERSION + '"',
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

  // -- Context reader --------------------------------------------------------
  /**
   * Read royalte_workspace_context, validate, and enforce workspace contract.
   *
   * @param {Object} [options]
   * @param {string} [options.contract]  Named contract from WORKSPACE_CONTRACTS registry.
   *   Preferred. Enforces required domains, required fields, and required types.
   * @param {string[]} [options.required]  Legacy: array of domain keys that must be non-null.
   *   Supported for backward compatibility. Does not check field paths or types.
   *
   * @returns {{ state, ctx, reason, missingDomains?, missingFields?, typeMismatches? }}
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

      // -- Named contract enforcement ----------------------------------------
      if (options && options.contract) {
        return validateContract(result.ctx, options.contract);
      }

      // -- Legacy required-domain list ---------------------------------------
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

  var RoyalteContext = {
    SCHEMA_VERSION:      SCHEMA_VERSION,
    MAX_AGE_MS:          MAX_AGE_MS,
    STORAGE_KEY:         STORAGE_KEY,
    WORKSPACE_CONTRACTS: WORKSPACE_CONTRACTS,
    validate:            validate,
    validateContract:    validateContract,
    readWorkspaceContext: readWorkspaceContext,
  };

  // Browser global
  if (typeof global !== 'undefined' && global.window === global) {
    global.RoyalteContext = RoyalteContext;
  }
  // Node.js export for tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoyalteContext;
  }

}(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
