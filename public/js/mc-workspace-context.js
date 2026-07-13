// ─────────────────────────────────────────────────────────────────────────
// ROYALTĒ MISSION CONTROL™ — RUNTIME CONTEXT CONTRACT v1.1
//
// Architectural rules (Board-locked 2026-07-12):
//   ONE source of truth.  MC writes it.  Workspaces read it.
//   Workspaces are pure renderers — they receive context and render.
//   If context is absent or invalid → show "No scan loaded."
//   Never fall back to demo data.  Never source data independently.
//
// Runtime flow:
//   Scan → Canonical Payload → __mcPopulate() → royalte_workspace_context
//                                                         ↓
//                                              readWorkspaceContext()
//                                                         ↓
//                                                  Workspace renderer
//
// FORWARD COMPATIBILITY — Master Field Registry (v2.0 target):
//   Workspaces declare required domains via readWorkspaceContext({ required: [] }).
//   The validator enforces domain presence today.
//   When the Master Field Registry ships, the required[] declaration becomes
//   a formal Workspace Contract derived from the registry spec.
//   No workspace rewrite is needed at that point — contracts are already in place.
//
// State enum: 'valid' | 'missing' | 'invalid' | 'expired' | 'missing_domain'
//   Workspaces treat all non-'valid' states identically: show overlay, stop.
//   The distinction exists for diagnostics and future tooling only.
//
// Every workspace loads this file before its wiring script.
// SCHEMA_VERSION must match the value written by mission-control.js.
// ─────────────────────────────────────────────────────────────────────────

(function (global) {
  'use strict';

  var SCHEMA_VERSION = '1.0';
  var MAX_AGE_MS     = 4 * 60 * 60 * 1000;  // 4 hours — context expires after this
  var STORAGE_KEY    = 'royalte_workspace_context';

  /**
   * Validate a parsed context object against the runtime schema.
   * Returns { state, ctx, reason }.
   * state: 'valid' | 'missing' | 'invalid' | 'expired'
   */
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

  /**
   * Read royalte_workspace_context from sessionStorage, validate, and optionally
   * enforce a workspace domain contract.
   *
   * Always returns { state, ctx, reason } — never throws.
   *
   * @param {Object} [options]
   * @param {string[]} [options.required]
   *   Domain keys that must be non-null in the context for this workspace to render.
   *   Example: { required: ['healthIntelligence', 'monitoringIntelligence'] }
   *
   *   Forward-compatibility note: these declarations become formal Workspace Contracts™
   *   when the Master Field Registry ships. No workspace changes are required at
   *   that point — the registry replaces the manual string list, not the call site.
   *
   * State values:
   *   'valid'          — context present, schema matches, not expired, all required domains present
   *   'missing'        — no context in sessionStorage
   *   'invalid'        — context present but schema version or artist missing
   *   'expired'        — context present but older than MAX_AGE_MS
   *   'missing_domain' — context valid but a required domain is absent from this scan
   *
   * All non-'valid' states: show #ws-no-scan-overlay, stop rendering.
   */
  function readWorkspaceContext(options) {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { state: 'missing', ctx: null, reason: 'key absent from sessionStorage' };
      }
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        return { state: 'invalid', ctx: null, reason: 'JSON parse error: ' + parseErr.message };
      }
      var result = validate(parsed);
      if (result.state !== 'valid') return result;

      // Workspace Contract enforcement.
      // If the caller declared required domains, verify all are present in this scan.
      // Missing domains trigger the overlay — the workspace cannot render partial intelligence.
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
    SCHEMA_VERSION:       SCHEMA_VERSION,
    MAX_AGE_MS:           MAX_AGE_MS,
    STORAGE_KEY:          STORAGE_KEY,
    validate:             validate,
    readWorkspaceContext: readWorkspaceContext,
  };

}(window));
