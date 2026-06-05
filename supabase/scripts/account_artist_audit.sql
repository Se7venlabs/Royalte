-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Account artist-identity audit (2026-06-05, post-PR #101)
--
-- READ-ONLY forensic report. NO INSERTS, UPDATES, OR DELETES.
--
-- Produced in response to the artist-identity contamination investigation:
-- an account showed "ALT BLK ERA — Monitoring Started" interleaved with
-- unrelated releases (Nosferatu, Knockin' On Heaven's Door, Everything Is
-- Over, Strange Situation) in the Mission Control Intelligence Feed.
--
-- The frontend fix (PR #101) scopes every alert query by (user_id, artist_id)
-- so the contamination is no longer visible in the UI. This script gives
-- the founder full visibility into the underlying DB state so the cleanup
-- plan can be designed against real numbers — not estimates.
--
-- Usage (via psql, Session Pooler):
--   psql "$DATABASE_URL" -v audit_user_id="'4375a85b-52bf-4a28-9d61-09ccce43ca30'" \
--                        -f supabase/scripts/account_artist_audit.sql
--
-- To audit a different account, change the :audit_user_id line below or
-- pass -v audit_user_id="'<uuid>'" on the psql command line.
--
-- Reads only. Safe to re-run. Lives in supabase/scripts/, not migrations/.
-- ─────────────────────────────────────────────────────────────────────────────

\set audit_user_id      '''4375a85b-52bf-4a28-9d61-09ccce43ca30'''

-- Demo-seed signature from scripts/seed-mc-demo-alerts.js (lines 31-33).
-- Any row matching this artist_id OR artist_name is suspected demo data.
\set demo_seed_artist_id   '''1lnM3VZrD6SG9vxBsE9654'''
\set demo_seed_artist_name '''Black Alternative'''


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 1 — Account identity
\echo ═══════════════════════════════════════════════════════════════════════

select
  u.id           as user_id,
  u.email,
  u.created_at   as user_created_at,
  p.tier,
  p.monitoring_status,
  p.founding_artist
from auth.users u
left join public.profiles p on p.id = u.id
where u.id = :audit_user_id;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 2 — Artists attached via monitoring_subscriptions
\echo ═══════════════════════════════════════════════════════════════════════
\echo (one row per artist this account is actively monitoring)

select
  artist_name,
  artist_id                     as spotify_artist_id,
  scan_frequency,
  active,
  last_scanned_at,
  next_scan_at,
  created_at
from public.monitoring_subscriptions
where user_id = :audit_user_id
order by created_at;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 3 — Every distinct artist found ANYWHERE in this account
\echo ═══════════════════════════════════════════════════════════════════════
\echo (unions monitoring_subscriptions + scan_snapshots + monitoring_alerts;
\echo  any artist that appears in one table but not all three is suspect)

with sub_artists as (
  select distinct artist_id, artist_name, 'monitoring_subscriptions' as source
  from public.monitoring_subscriptions
  where user_id = :audit_user_id
), snap_artists as (
  select distinct artist_id, artist_name, 'scan_snapshots' as source
  from public.scan_snapshots
  where user_id = :audit_user_id
    and artist_id is not null
), alert_artists as (
  select distinct artist_id, artist_name, 'monitoring_alerts' as source
  from public.monitoring_alerts
  where user_id = :audit_user_id
), combined as (
  select * from sub_artists
  union all select * from snap_artists
  union all select * from alert_artists
)
select
  artist_id,
  artist_name,
  bool_or(source = 'monitoring_subscriptions') as in_subscriptions,
  bool_or(source = 'scan_snapshots')           as in_scan_snapshots,
  bool_or(source = 'monitoring_alerts')        as in_monitoring_alerts,
  case
    when artist_id = :demo_seed_artist_id
      or artist_name = :demo_seed_artist_name
    then '*** DEMO SEED ***'
    when not bool_or(source = 'monitoring_subscriptions')
    then '*** ORPHAN: in alerts/snapshots but no active subscription ***'
    else ''
  end as flag
from combined
group by artist_id, artist_name
order by flag desc nulls last, artist_name;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 4 — monitoring_alerts: rows per (artist_id, change_type)
\echo ═══════════════════════════════════════════════════════════════════════

select
  artist_name,
  artist_id,
  change_type,
  severity,
  count(*)               as row_count,
  min(detected_at)       as earliest,
  max(detected_at)       as latest,
  case
    when artist_id = :demo_seed_artist_id
      or artist_name = :demo_seed_artist_name
    then '*** DEMO SEED ***'
    else ''
  end as flag
from public.monitoring_alerts
where user_id = :audit_user_id
group by artist_name, artist_id, change_type, severity
order by artist_name, change_type;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 5 — Suspected demo-seed rows (detailed)
\echo ═══════════════════════════════════════════════════════════════════════
\echo (matches scripts/seed-mc-demo-alerts.js signature exactly:
\echo  artist_id = 1lnM3VZrD6SG9vxBsE9654  OR  artist_name = Black Alternative)

select
  'monitoring_alerts' as table_name,
  id,
  artist_id,
  artist_name,
  change_type,
  severity,
  track_name,
  detected_at,
  resolved
from public.monitoring_alerts
where user_id = :audit_user_id
  and (artist_id   = :demo_seed_artist_id
    or artist_name = :demo_seed_artist_name)
order by detected_at;

select
  'monitoring_subscriptions' as table_name,
  id,
  artist_id,
  artist_name,
  scan_frequency,
  active,
  created_at
from public.monitoring_subscriptions
where user_id = :audit_user_id
  and (artist_id   = :demo_seed_artist_id
    or artist_name = :demo_seed_artist_name);

select
  'scan_snapshots' as table_name,
  id,
  artist_id,
  artist_name,
  scan_number,
  source,
  status,
  scanned_at
from public.scan_snapshots
where user_id = :audit_user_id
  and (artist_id   = :demo_seed_artist_id
    or artist_name = :demo_seed_artist_name)
order by scanned_at;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 6 — scan_snapshots inventory
\echo ═══════════════════════════════════════════════════════════════════════

select
  artist_name,
  artist_id,
  source,
  status,
  count(*)            as snapshot_count,
  min(scanned_at)     as first_scan,
  max(scanned_at)     as latest_scan,
  case
    when artist_id = :demo_seed_artist_id
      or artist_name = :demo_seed_artist_name
    then '*** DEMO SEED ***'
    else ''
  end as flag
from public.scan_snapshots
where user_id = :audit_user_id
group by artist_name, artist_id, source, status
order by latest_scan desc;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 7 — Totals
\echo ═══════════════════════════════════════════════════════════════════════

select
  (select count(*) from public.monitoring_subscriptions where user_id = :audit_user_id) as subscriptions_total,
  (select count(*) from public.scan_snapshots          where user_id = :audit_user_id) as snapshots_total,
  (select count(*) from public.monitoring_alerts       where user_id = :audit_user_id) as alerts_total,
  (select count(*) from public.monitoring_alerts       where user_id = :audit_user_id and resolved = false) as alerts_unresolved,
  (select count(*) from public.monitoring_alerts
     where user_id = :audit_user_id
       and (artist_id = :demo_seed_artist_id or artist_name = :demo_seed_artist_name)) as suspected_demo_alerts,
  (select count(*) from public.scan_snapshots
     where user_id = :audit_user_id
       and (artist_id = :demo_seed_artist_id or artist_name = :demo_seed_artist_name)) as suspected_demo_snapshots,
  (select count(*) from public.monitoring_subscriptions
     where user_id = :audit_user_id
       and (artist_id = :demo_seed_artist_id or artist_name = :demo_seed_artist_name)) as suspected_demo_subscriptions;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo SECTION 8 — V1 audit_scans inventory (separate table; pre-V2 history)
\echo ═══════════════════════════════════════════════════════════════════════
\echo (audit_scans was the V1 surface; rows may exist with NULL user_id from
\echo  anonymous scans, plus matched-by-session rows. Read-only, for context.)

select
  artist_name,
  spotify_artist_id,
  apple_artist_id,
  url_type,
  count(*)              as scan_count,
  min(created_at)       as earliest,
  max(created_at)       as latest
from public.audit_scans
where user_id = :audit_user_id
group by artist_name, spotify_artist_id, apple_artist_id, url_type
order by latest desc;


\echo
\echo ═══════════════════════════════════════════════════════════════════════
\echo End of report. No data was modified.
\echo ═══════════════════════════════════════════════════════════════════════
\echo
