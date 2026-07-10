// GET /api/health
//
// Royaltē Production Health Check™
// Validates that all critical server-side environment variables are present
// and non-empty. Returns 200 (healthy) or 503 (degraded/critical).
//
// Authorization: Bearer <INTERNAL_API_SECRET>
//
// This endpoint exists because silently empty env vars cause degraded
// production behavior with no visible failure (e.g. scan results not
// persisted, rate limiting disabled, MRP saves silently failing).
// Fail fast and make the gap visible.

const CHECKS = [
  // ── Database ─────────────────────────────────────────────────────────────
  { name: 'SUPABASE_URL',              category: 'database',  critical: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', category: 'database',  critical: true },

  // ── Email ─────────────────────────────────────────────────────────────────
  { name: 'RESEND_API_KEY',            category: 'email',     critical: true },

  // ── Apple Music (canonical intelligence source) ───────────────────────────
  { name: 'APPLE_TEAM_ID',             category: 'apple',     critical: true },
  { name: 'APPLE_KEY_ID',              category: 'apple',     critical: true },
  { name: 'APPLE_PRIVATE_KEY',         category: 'apple',     critical: true },

  // ── Spotify (verification layer) ─────────────────────────────────────────
  { name: 'SPOTIFY_CLIENT_ID',         category: 'spotify',   critical: true },
  { name: 'SPOTIFY_CLIENT_SECRET',     category: 'spotify',   critical: true },

  // ── Internal security ────────────────────────────────────────────────────
  { name: 'INTERNAL_API_SECRET',       category: 'internal',  critical: true },
  { name: 'CRON_SECRET',               category: 'internal',  critical: true },

  // ── Supplemental intelligence (degrades gracefully if absent) ────────────
  { name: 'YOUTUBE_API_KEY',           category: 'youtube',   critical: false },
  { name: 'LASTFM_API_KEY',            category: 'lastfm',    critical: false },
  { name: 'TIDAL_CLIENT_ID',           category: 'tidal',     critical: false },
  { name: 'TIDAL_CLIENT_SECRET',       category: 'tidal',     critical: false },
  { name: 'DISCOGS_CONSUMER_KEY',      category: 'discogs',   critical: false },
  { name: 'DISCOGS_CONSUMER_SECRET',   category: 'discogs',   critical: false },
  { name: 'LISTEN_NOTES_API_KEY',      category: 'podcasts',  critical: false },
];

export default function handler(req, res) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.INTERNAL_API_SECRET;
  const auth   = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();

  if (!secret || auth !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Evaluate every check ──────────────────────────────────────────────────
  const results = CHECKS.map(({ name, category, critical }) => {
    const val     = process.env[name];
    const present = typeof val === 'string' && val.trim().length > 0;
    return { name, category, critical, present };
  });

  const missing         = results.filter(r => !r.present);
  const missingCritical = missing.filter(r => r.critical);
  const missingWarning  = missing.filter(r => !r.critical);
  const healthy         = missingCritical.length === 0;

  const body = {
    status:    healthy ? 'healthy' : 'critical',
    timestamp: new Date().toISOString(),
    summary: {
      total:            CHECKS.length,
      present:          results.filter(r => r.present).length,
      missingCritical:  missingCritical.length,
      missingWarning:   missingWarning.length,
    },
    checks: results.map(({ name, category, critical, present }) => ({
      name,
      category,
      critical,
      status: present ? 'ok' : (critical ? 'MISSING_CRITICAL' : 'missing_warning'),
    })),
  };

  return res.status(healthy ? 200 : 503).json(body);
}
