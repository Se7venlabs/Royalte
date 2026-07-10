// GET /api/health
//
// Royaltē Production Health Report™
// Single source of truth for production readiness before and after every deployment.
//
// Authorization: Bearer <INTERNAL_API_SECRET>
//
// Returns HTTP 200 + { status: "healthy", ... } when all critical deps pass.
// Returns HTTP 503 + { status: "degraded", ... } when any critical dep fails.
//
// Designed for extension: add new check functions below and register them in
// CHECKS_CRITICAL or CHECKS_WARNING. Each check returns a status string —
// "ok" is the only passing value; anything else describes the failure.
//
// Never exposes secrets, keys, URLs containing credentials, or internal error text.

import { createClient } from '@supabase/supabase-js';

// ── Individual check functions ────────────────────────────────────────────────
// Each returns a status string. "ok" = pass. Anything else = fail reason.
// Functions are async to allow real connectivity probes.

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !url.trim())  return 'missing_url';
  if (!key || !key.trim())  return 'missing_service_role_key';
  return 'ok';
}

async function checkDatabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'skipped';
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from('profiles').select('id').limit(1);
    return error ? 'query_failed' : 'ok';
  } catch {
    return 'connection_failed';
  }
}

async function checkResend() {
  const key = process.env.RESEND_API_KEY;
  return (key && key.trim()) ? 'ok' : 'missing_api_key';
}

async function checkAppleMusic() {
  if (!process.env.APPLE_TEAM_ID    || !process.env.APPLE_TEAM_ID.trim())    return 'missing_team_id';
  if (!process.env.APPLE_KEY_ID     || !process.env.APPLE_KEY_ID.trim())     return 'missing_key_id';
  if (!process.env.APPLE_PRIVATE_KEY || !process.env.APPLE_PRIVATE_KEY.trim()) return 'missing_private_key';
  return 'ok';
}

async function checkSpotify() {
  if (!process.env.SPOTIFY_CLIENT_ID     || !process.env.SPOTIFY_CLIENT_ID.trim())     return 'missing_client_id';
  if (!process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_CLIENT_SECRET.trim()) return 'missing_client_secret';
  return 'ok';
}

async function checkInternalApi() {
  // INTERNAL_API_SECRET is implicitly validated by the auth gate above —
  // we only reach this point if it matched. Flag it ok unconditionally.
  return 'ok';
}

// ── Check registry ────────────────────────────────────────────────────────────
// CHECKS_CRITICAL: any failure → HTTP 503 + status "degraded"
// CHECKS_WARNING:  failure recorded but does not affect top-level status
//
// To add a future check (OpenAI, MLC, Discogs, scan engine, CDN, etc.):
//   1. Write a check function above
//   2. Register it in CHECKS_CRITICAL or CHECKS_WARNING

const CHECKS_CRITICAL = [
  { key: 'supabase',      fn: checkSupabase    },
  { key: 'database',      fn: checkDatabase    },
  { key: 'resend',        fn: checkResend      },
  { key: 'apple_music',   fn: checkAppleMusic  },
  { key: 'internal_api',  fn: checkInternalApi },
];

const CHECKS_WARNING = [
  // Spotify degrades gracefully — not critical to core scan path
  { key: 'spotify', fn: checkSpotify },
];

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const secret = process.env.INTERNAL_API_SECRET;
  const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();

  if (!secret || bearer !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [criticalResults, warningResults] = await Promise.all([
    Promise.all(CHECKS_CRITICAL.map(async ({ key, fn }) => [key, await fn()])),
    Promise.all(CHECKS_WARNING.map(async ({ key, fn }) => [key, await fn()])),
  ]);

  const checks = Object.fromEntries([...criticalResults, ...warningResults]);

  const criticalFailed = criticalResults
    .filter(([, status]) => status !== 'ok' && status !== 'skipped')
    .map(([key]) => key);

  const status = criticalFailed.length === 0 ? 'healthy' : 'degraded';

  return res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    checks,
    ...(criticalFailed.length > 0 && { critical_failures: criticalFailed }),
  });
}
