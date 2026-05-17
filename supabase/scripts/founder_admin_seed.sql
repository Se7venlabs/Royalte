-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Founder/Admin QA environment seed  (Block F — one-off, NOT a migration)
--
-- Provisions the founder admin account (darryl.west+admin@gmail.com) as a REAL,
-- populated Royaltē OS account anchored to the BLACK ALTERNATIVE scan, so the
-- founder can log in from the website and land in a populated dashboard for
-- pre-launch QA / demo.
--
-- This is a deliberate reversal of the Block F "isolated admin" model: the
-- admin short-circuit in handle_new_user() left this account with no profile.
-- This script gives it one. handle_new_user() itself is NOT changed — it only
-- governs FUTURE signups; this account already exists, so the rows are seeded
-- directly here.
--
-- This is founder QA data seeding, not product schema — it lives in
-- supabase/scripts/, not supabase/migrations/. Hardcoded UUIDs are intentional
-- (single-account seed). Idempotent: safe to re-run.
--
-- Decisions locked (this phase):
--   - tier = 'pro', monitoring_status = 'active', founding_artist = true
--     (the founder QA env behaves like a full Founding Artist account)
--   - source scan = 1142f754-cb96-401a-bf59-c0b683d9d0d0 (BLACK ALTERNATIVE),
--     used as-is (sparse real data accepted)
--
-- Apply via psql over the Session Pooler (explicit-flags form, per CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

\set admin_user_id '''cc30f672-22c1-4def-90ab-6dc7ed431c7c'''
\set admin_email   '''darryl.west+admin@gmail.com'''
\set scan_id       '''1142f754-cb96-401a-bf59-c0b683d9d0d0'''

begin;

-- ── 1. Admin profiles row ───────────────────────────────────────────────────
-- A full Pro / Founding Artist account. monitoring_status='active' means
-- activateTrialIfNeeded() in dashboard.js no-ops (it only acts on 'inactive').
-- next_rescan_at is set to a future date so the Monitoring section renders a
-- sensible "next rescan" line. ON CONFLICT DO UPDATE keeps the re-run safe and
-- corrects the state if the row already exists.

INSERT INTO public.profiles (
  id, email, display_name, founding_artist, tier,
  monitoring_status, next_rescan_at, trial_started_at
)
VALUES (
  :admin_user_id,
  :admin_email,
  'Founder QA',
  true,
  'pro',
  'active',
  now() + interval '7 days',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  founding_artist   = EXCLUDED.founding_artist,
  tier              = EXCLUDED.tier,
  monitoring_status = EXCLUDED.monitoring_status,
  next_rescan_at    = EXCLUDED.next_rescan_at,
  updated_at        = now();

-- ── 2. Link the BLACK ALTERNATIVE scan to the admin ─────────────────────────
-- Claims the anonymous audit_scans row. Guarded so a re-run is a no-op and it
-- never steals a scan already owned by a different user.

UPDATE public.audit_scans
SET user_id = :admin_user_id
WHERE id = :scan_id
  AND (user_id IS NULL OR user_id = :admin_user_id);

-- ── 3. scan_snapshots row from the BLACK ALTERNATIVE payload ────────────────
-- The dashboard reads living state from scan_snapshots (audit_scans is only a
-- fallback). Seq 1, source 'signup_scan'. created_at copied from the original
-- scan so the snapshot timeline is honest. UNIQUE (user_id, sequence_number)
-- makes this safe to re-run.

INSERT INTO public.scan_snapshots (user_id, sequence_number, payload, source, created_at)
SELECT :admin_user_id, 1, payload, 'signup_scan', created_at
FROM public.audit_scans
WHERE id = :scan_id
ON CONFLICT (user_id, sequence_number) DO NOTHING;

commit;

-- ── Verification (run after commit) ─────────────────────────────────────────
-- Expect: 1 profile row (pro / active / founding_artist t); audit_scans.user_id
-- = admin id; 1 scan_snapshots row (seq 1) with subject.artistName 'Black
-- Alternative'.

SELECT 'profile'      AS check, id::text, email, tier, monitoring_status, founding_artist::text
  FROM public.profiles WHERE id = :admin_user_id
UNION ALL
SELECT 'audit_scan',  id::text, artist_name, url_type, user_id::text, ''
  FROM public.audit_scans WHERE id = :scan_id
UNION ALL
SELECT 'snapshot',    id::text, (payload->'subject'->>'artistName'), source,
       sequence_number::text, user_id::text
  FROM public.scan_snapshots WHERE user_id = :admin_user_id;
