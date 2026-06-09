-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Founder admin recovery  (Block F — one-off, NOT a migration)
--
-- The original founder admin account (darryl.west+admin@gmail.com, seeded by
-- migration 20260517182237) was removed during a cleanup. This script restores
-- admin access onto the founder's PRIMARY account, darryl.west@gmail.com — an
-- existing auth.users row (created 2026-05-15) that signed up through the
-- normal customer flow.
--
-- It is the recovery counterpart of founder_admin_seed.sql, adapted from the
-- deleted +admin account to the primary account, and verified against live DB
-- state before authoring:
--   - admin_users had 0 rows — the +admin allowlist row cascaded away with the
--     deleted auth user, so step 1 is a clean INSERT (no stale row to remove).
--   - darryl.west@gmail.com already has a profiles row (free / grace_period) —
--     step 3 promotes it in place via ON CONFLICT DO UPDATE.
--   - the founder had 0 scan_snapshots — step 5 is a clean seq-1 INSERT.
--
-- handle_new_user() is unchanged: it only governs FUTURE signups, and links
-- admin_users.user_id at signup time. This account already exists, so user_id
-- is set directly here.
--
-- Founder QA data seeding, not product schema — lives in supabase/scripts/,
-- not supabase/migrations/. Idempotent: safe to re-run. Apply via psql over
-- the Session Pooler (explicit-flags form, per CLAUDE.md).
--
-- Decisions locked (carried from founder_admin_seed.sql):
--   - tier = 'pro', monitoring_status = 'active', founding_artist = true
--   - source scan = da6c53dc-148e-4cd1-abfa-d3fa2160e1a2 — a FRESH Black
--     Alternative scan run post-Gap-Based-Exposure merge, so its payload is
--     canonical schema v1.1.0 with a populated gapBasedExposure component
--     (the old 1142f754… scan was v1.0.0 and would render an empty component).
-- ─────────────────────────────────────────────────────────────────────────────

\set admin_user_id '''4375a85b-52bf-4a28-9d61-09ccce43ca30'''
\set admin_email   '''darryl.west@gmail.com'''
\set scan_id       '''da6c53dc-148e-4cd1-abfa-d3fa2160e1a2'''

begin;

-- ── 1. admin_users — grant admin to the primary account ─────────────────────
-- checkAdminStatus() in dashboard.js queries admin_users by user_id (RLS
-- auth.uid() = user_id), so the row MUST carry user_id. handle_new_user()
-- would have linked it at signup, but this account predates the allowlist —
-- user_id is set explicitly. ON CONFLICT keeps the re-run safe.

INSERT INTO public.admin_users (email, user_id, note)
VALUES (
  :admin_email,
  :admin_user_id,
  'Founder admin — recovered onto the primary account after +admin cleanup'
)
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  note    = EXCLUDED.note;

-- ── 2. profiles — promote the existing customer profile to a Pro QA account ─
-- The account already has a profiles row from its 2026-05-15 customer signup
-- (free / grace_period). This promotes it to a full Pro / Founding Artist QA
-- account. monitoring_status='active' means activateTrialIfNeeded() in
-- dashboard.js no-ops; next_rescan_at is future so Monitoring renders sensibly.

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
  trial_started_at  = EXCLUDED.trial_started_at,
  updated_at        = now();

-- ── 3. Link the fresh BLACK ALTERNATIVE scan to the founder ─────────────────
-- Claims the anonymous audit_scans row. Guarded so a re-run is a no-op and it
-- never steals a scan already owned by a different user.

UPDATE public.audit_scans
SET user_id = :admin_user_id
WHERE id = :scan_id
  AND (user_id IS NULL OR user_id = :admin_user_id);

-- ── 4. scan_snapshots row from the BLACK ALTERNATIVE payload ────────────────
-- The dashboard reads living state from scan_snapshots (latest by
-- sequence_number); audit_scans is only a fallback. Seq 1, source
-- 'signup_scan', created_at copied from the original scan so the timeline is
-- honest. UNIQUE (user_id, sequence_number) makes this safe to re-run.

INSERT INTO public.scan_snapshots (user_id, sequence_number, payload, source, created_at)
SELECT :admin_user_id, 1, payload, 'signup_scan', created_at
FROM public.audit_scans
WHERE id = :scan_id
ON CONFLICT (user_id, sequence_number) DO NOTHING;

commit;

-- ── Verification (runs after commit) ────────────────────────────────────────
-- Expect: 1 admin_users row (user_id linked); 1 profiles row (pro / active /
-- founding_artist t); audit_scans.user_id = founder id; 1 scan_snapshots row
-- (seq 1) whose payload subject.artistName is 'Black Alternative'.

SELECT 'admin_users' AS check, email, user_id::text, note
  FROM public.admin_users WHERE user_id = :admin_user_id
UNION ALL
SELECT 'profile', email, tier || ' / ' || monitoring_status,
       'founding_artist=' || founding_artist::text
  FROM public.profiles WHERE id = :admin_user_id
UNION ALL
SELECT 'audit_scan', artist_name, user_id::text, id::text
  FROM public.audit_scans WHERE id = :scan_id
UNION ALL
SELECT 'snapshot', (payload->'subject'->>'artistName'),
       'seq ' || sequence_number::text,
       'gapBasedExposure.hasAnyGaps=' || (payload->'gapBasedExposure'->>'hasAnyGaps')
  FROM public.scan_snapshots WHERE user_id = :admin_user_id;
