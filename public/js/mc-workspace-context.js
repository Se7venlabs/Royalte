// ─────────────────────────────────────────────────────────────────────────
// ROYALTĒ MISSION CONTROL™ — RUNTIME CONTEXT CONTRACT v1.0
//
// Architectural rule (Board-locked 2026-07-12):
//   ONE source of truth.  MC writes it.  Workspaces read it.
//   Workspaces are pure renderers — they receive context and render.
//   If context is absent or invalid → show "No scan loaded."
//   Never fall back to demo data.  Never source data independently.
//
// Runtime flow:
//   Scan → Canonical Payload → __mcPopulate() → royalte_workspace_context
//                                                         ↓
//                                                  Workspace renderer
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
   * Validate a parsed context object.
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
   * Read royalte_workspace_context from sessionStorage and validate.
   * Always returns { state, ctx, reason } — never throws.
   * state: 'valid' | 'missing' | 'invalid' | 'expired'
   */
  function readWorkspaceContext() {
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
      return validate(parsed);
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
