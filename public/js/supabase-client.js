// Supabase browser client — singleton.
//
// Imported by any page that needs auth or RLS-scoped DB access:
//   import { getSupabase, getOrCreateSessionId } from '/js/supabase-client.js';
//
// The anon key below is a PUBLIC credential by design. It only grants
// RLS-scoped access — every table that matters is protected by row-level
// security. The service-role key is server-only and never appears in any
// client/public file.

// Vendored locally at /js/vendor/supabase-js.js — NOT loaded from the esm.sh
// CDN. A CDN connection failure was freezing /auth/callback (the auth library
// failed to load, so no Supabase call could fire). See public/js/vendor/.
import { createClient } from '/js/vendor/supabase-js.js';

const SUPABASE_URL = 'https://dhfndrrfekwuxzgjblci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZm5kcnJmZWt3dXh6Z2pibGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzM4NTMsImV4cCI6MjA5MjEwOTg1M30.7WjaiC4JvoLEghRQzSqo0VogZ6GBzgd_ipPhFf2Ida4';

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    console.error('[supabase] client init failed', e);
    return null;
  }
  return _client;
}

// Stable per-browser id for anonymous scans, stored in localStorage so the
// same id is reused across scan runs in this browser. It's the bridge
// between an anonymous scan and the user account that later claims it
// (via the migrate_anonymous_scans RPC after sign-in).
export function getOrCreateSessionId() {
  const KEY = 'royalte_session_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch (e) {
    // localStorage blocked (private mode / hardened browser) — return a
    // non-persistent id so the scan still runs; it just can't be migrated.
    return crypto.randomUUID();
  }
}

// Legacy bridge: the homepage scan code (runAudit) lives in a regular
// non-module <script> block and cannot `import`. Expose getOrCreateSessionId
// AND getSupabase on window so that block can tag scans with the session_id
// and resolve the auth session (for the V2 OS Authorization: Bearer header).
// Drop both when the homepage scan code moves into a module.
if (typeof window !== 'undefined') {
  window.getOrCreateSessionId = getOrCreateSessionId;
  window.getSupabase          = getSupabase;
}
