// Royaltē — /api/_lib/rate-limit.js
//
// Shared anti-abuse helpers used by /api/audit and /api/submit-audit.
//
// - extractIp(req)            → resolves client IP from Vercel headers
// - checkBlocked(supabase,ip) → returns { blocked, expiresAt } from blocked_ips
// - checkRateLimit(...)       → increments counters, enforces burst+hour+day
// - recordViolation(...)      → escalates to 24h block after N violations/hour
//
// Storage: Supabase (two tables: rate_limits, blocked_ips). See _migrations/rate-limit-schema.sql.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// Lazily-initialised client (module-scoped singleton per function instance)
let _sb = null;
function getSupabase() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[rate-limit] Supabase credentials not configured');
  _sb = createClient(url, key);
  return _sb;
}

// ── IP EXTRACTION ────────────────────────────────────────────────────────────
// Vercel sets x-forwarded-for (comma-separated, client first); x-real-ip fallback.
// Returns null if neither exists — callers should fail-open on null per policy.
export function extractIp(req) {
  try {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const first = xff.split(',')[0].trim();
      if (first) return first;
    }
    const xri = req.headers['x-real-ip'];
    if (xri) return xri.trim();
  } catch (_) {}
  return null;
}

// ── BLOCKED IP CHECK ─────────────────────────────────────────────────────────
// Returns { blocked: true, expiresAt } if IP is in blocked_ips and not yet expired.
// Fail-open on error (never hard-block legit traffic on a DB blip).
export async function checkBlocked(ip) {
  if (!ip) return { blocked: false };
  try {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('ip, expires_at')
      .eq('ip', ip)
      .gt('expires_at', nowIso)
      .maybeSingle();
    if (error) {
      console.warn('[rate-limit] blocked_ips check failed (fail-open):', error.message);
      return { blocked: false };
    }
    if (data) return { blocked: true, expiresAt: data.expires_at };
    return { blocked: false };
  } catch (e) {
    console.warn('[rate-limit] checkBlocked exception (fail-open):', e.message);
    return { blocked: false };
  }
}

// ── WINDOW HELPERS ───────────────────────────────────────────────────────────
// Normalises timestamps to the start of their window so multiple requests in
// the same window collide on the unique (ip, endpoint, window_type, window_start) key.
function startOfBurstWindow(now) {
  // 10-second buckets
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(Math.floor(d.getUTCSeconds() / 10) * 10);
  return d;
}
function startOfHourWindow(now) {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  return d;
}
function startOfDayWindow(now) {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  d.setUTCHours(0);
  return d;
}

// ── RATE LIMIT CHECK + INCREMENT ─────────────────────────────────────────────
// limits: { burst: { max, windowSeconds }, hour: { max }, day: { max } }
// Behaviour per window type:
//   burst: max requests in current 10-second bucket
//   hour:  max requests in current UTC hour
//   day:   max requests in current UTC day
//
// On 429, returns { allowed: false, reason, retryAfter } (seconds until the next window).
// Fail-open on DB errors (log + allow) to avoid locking out legit traffic on outages.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkRateLimit(ip, endpoint, limits) {
  if (!ip) return { allowed: true, reason: 'no_ip' }; // fail-open per policy

  try {
    const supabase = getSupabase();
    const now = new Date();
    const windows = [
      { type: 'burst', start: startOfBurstWindow(now), max: limits.burst?.max ?? null, seconds: 10 },
      { type: 'hour',  start: startOfHourWindow(now),  max: limits.hour?.max  ?? null, seconds: 3600 },
      { type: 'day',   start: startOfDayWindow(now),   max: limits.day?.max   ?? null, seconds: 86400 },
    ].filter(w => w.max != null);

    // Atomic check-and-increment per window via SECURITY DEFINER RPC.
    // PG's row-level lock on the INSERT...ON CONFLICT serialises parallel
    // callers, so N concurrent requests get monotonically increasing counts
    // (1, 2, 3, ...) instead of all racing to count=1.
    //
    // Short-circuit on the first window that rejects. Earlier windows that
    // already incremented stay incremented — that's correct: the request
    // does count against those windows even though it was blocked by a
    // later one. Order matters: burst (smallest max, most likely to reject)
    // is checked first to minimise over-counting on rejection.
    for (const w of windows) {
      const { data, error } = await supabase.rpc('rate_limit_check_and_increment', {
        p_ip:           ip,
        p_endpoint:     endpoint,
        p_window:       w.type,
        p_window_start: w.start.toISOString(),
        p_max:          w.max,
      });
      if (error) {
        console.warn('[rate-limit] RPC failed (fail-open):', error.message);
        return { allowed: true, reason: 'rpc_error' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.allowed) continue; // window passed (or unexpected shape — fail-open)
      // Window rejected — compute retry-after = seconds until next window starts
      const nextStart = new Date(w.start.getTime() + (w.seconds * 1000));
      const retryAfter = Math.max(1, Math.ceil((nextStart.getTime() - now.getTime()) / 1000));
      return { allowed: false, reason: w.type, retryAfter };
    }

    return { allowed: true };
  } catch (e) {
    console.warn('[rate-limit] checkRateLimit exception (fail-open):', e.message);
    return { allowed: true, reason: 'exception' };
  }
}

// ── VIOLATION TRACKING → 24H BLOCK ───────────────────────────────────────────
// Called when an IP gets a 429. After 5 violations in the current hour,
// escalates to a 24-hour block in blocked_ips.
// Counts violations using the rate_limits table with a special endpoint key.
export async function recordViolation(ip, endpoint, reason) {
  if (!ip) return;

  try {
    const supabase = getSupabase();
    const now = new Date();
    const hourStart = startOfHourWindow(now);
    const violationKey = `__violations__:${endpoint}`;

    // Read current violation count for this hour
    const { data: row, error: readErr } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('ip', ip)
      .eq('endpoint', violationKey)
      .eq('window_type', 'hour')
      .eq('window_start', hourStart.toISOString())
      .maybeSingle();

    if (readErr && readErr.code !== 'PGRST116') {
      console.warn('[rate-limit] violation read failed:', readErr.message);
      return;
    }

    const nextCount = ((row?.count) || 0) + 1;

    // Increment violation counter
    const { error: upErr } = await supabase
      .from('rate_limits')
      .upsert({
        ip,
        endpoint: violationKey,
        window_type: 'hour',
        window_start: hourStart.toISOString(),
        count: nextCount,
        updated_at: now.toISOString(),
      }, { onConflict: 'ip,endpoint,window_type,window_start' });
    if (upErr) {
      console.warn('[rate-limit] violation upsert failed:', upErr.message);
      return;
    }

    // At 5+ violations in a single hour → 24h block
    if (nextCount >= 5) {
      const expiresAt = new Date(now.getTime() + (24 * 3600 * 1000));
      const { error: blockErr } = await supabase
        .from('blocked_ips')
        .upsert({
          ip,
          blocked_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          violation_count: nextCount,
          reason: `Auto-block: ${nextCount} rate-limit violations on ${endpoint} within 1 hour (last reason: ${reason})`,
        }, { onConflict: 'ip' });
      if (blockErr) {
        console.warn('[rate-limit] auto-block upsert failed:', blockErr.message);
      } else {
        console.warn(`[rate-limit] 🚫 Auto-blocked ${ip} for 24h — ${nextCount} violations on ${endpoint}`);
      }
    }
  } catch (e) {
    console.warn('[rate-limit] recordViolation exception:', e.message);
  }
}
