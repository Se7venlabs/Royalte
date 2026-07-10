// ─────────────────────────────────────────────────────────────────────
//  Royaltē OS™ — Reporting Time Zone™ utility
// ─────────────────────────────────────────────────────────────────────
//
//  Single owner of RTZ detection, storage, and abbreviation display.
//  Used by Mission Control™ to populate [data-mc-rtz-abbr] elements.
//
//  Resolution order (per Board Addendum 2026-07-03):
//    1. User's profile row (reporting_timezone — authenticated only)
//    2. localStorage (anonymous / cached)
//    3. Browser auto-detect via Intl.DateTimeFormat
//
//  The detected IANA zone (e.g. "America/Toronto") is persisted so
//  subsequent loads skip detection. The artist may override this value
//  from Settings → Preferences (future surface).
//
//  IP-based fallback is deferred to a future Board brief.
// ─────────────────────────────────────────────────────────────────────

import { getSupabase } from '/js/supabase-client.js';

const RTZ_LS_KEY = 'royalte_reporting_tz';

function _detectBrowserTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Converts an IANA zone name to the current short abbreviation.
// e.g. "America/New_York" → "EDT" or "EST" depending on date.
export function getTzAbbr(ianaZone) {
  try {
    const parts = Intl.DateTimeFormat('en-US', {
      timeZone: ianaZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || ianaZone;
  } catch {
    return ianaZone;
  }
}

async function _loadStored(supabase, userId) {
  if (userId && supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('reporting_timezone')
        .eq('id', userId)
        .single();
      if (data?.reporting_timezone) return data.reporting_timezone;
    } catch {}
  }
  try {
    return localStorage.getItem(RTZ_LS_KEY) || null;
  } catch {
    return null;
  }
}

async function _persist(supabase, userId, ianaZone) {
  try {
    localStorage.setItem(RTZ_LS_KEY, ianaZone);
  } catch {}
  if (userId && supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ reporting_timezone: ianaZone })
        .eq('id', userId);
    } catch {}
  }
}

function _applyToDOM(abbr) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-mc-rtz-abbr]').forEach(el => {
    el.textContent = abbr;
  });
}

// Detects, stores, and renders the Reporting Time Zone™.
// Call once on DOMContentLoaded — fire-and-forget.
export async function initRtz() {
  const supabase = getSupabase();
  let userId = null;
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {}
  }

  let ianaZone = await _loadStored(supabase, userId);
  if (!ianaZone) {
    ianaZone = _detectBrowserTz();
    await _persist(supabase, userId, ianaZone);
  }

  _applyToDOM(getTzAbbr(ianaZone));
}
