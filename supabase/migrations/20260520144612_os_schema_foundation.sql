-- ============================================================================
-- Royaltē OS (V2) — Schema Foundation
-- ----------------------------------------------------------------------------
-- Brief 001. Lays down the persistence layer for the V2 delta-based
-- monitoring engine:
--
--   • scan_snapshots — extended in place (additive). Every scan persists a
--     snapshot. Engine compares snapshot N vs N-1 to surface deltas.
--   • monitoring_alerts — dropped + recreated. The pre-existing table from
--     the 2026-05-10 phase1_paid_product migration was wired to billing
--     (subscription_id, alert_tier/alert_status enums). V2 alerts are
--     per-user/per-artist and tie to scan_snapshots, not subscriptions.
--   • monitoring_subscriptions — new. Per-(user, artist) scan-frequency
--     config; distinct from the Stripe-billing `subscriptions` table.
--
-- Decisions taken before writing this migration:
--   1. health_score: ADDED. Per founder, the V1 "no health-score framing"
--      lock (PR #24, 2026-05-14) applies to the V1 audit-display surface
--      only; the V2 OS uses a 0-100 health framing.
--   2. scan_snapshots: extended in place (additive). 3 live rows backfilled
--      from payload.subject; V1 columns (sequence_number, payload, created_at,
--      source event-types) preserved so the existing dashboard keeps working.
--   3. monitoring_alerts: existing table dropped (0 rows, no app code refs).
--      alert_tier/alert_status enums dropped with it.
--   4. monitoring_subscriptions: new separate table. The pre-existing
--      `subscriptions` (Stripe) stays as-is.
--
-- Schema only. No API/UI changes.
-- ============================================================================

begin;

-- ─── 1. scan_snapshots — extend in place ────────────────────────────────────

alter table scan_snapshots add column if not exists artist_id       text;
alter table scan_snapshots add column if not exists artist_name     text;
alter table scan_snapshots add column if not exists scan_number     integer;
-- scanned_at: NO column-default at ADD time. ADD COLUMN ... DEFAULT now() would
-- backfill every pre-existing row with the migration's runtime now() instead of
-- the row's original created_at. We backfill explicitly below, then set the
-- default for future V2 inserts.
alter table scan_snapshots add column if not exists scanned_at      timestamptz;
alter table scan_snapshots add column if not exists canonical_data  jsonb;
alter table scan_snapshots add column if not exists health_score    integer;
alter table scan_snapshots add column if not exists score_breakdown jsonb;
alter table scan_snapshots add column if not exists status          text;

alter table scan_snapshots
  drop constraint if exists scan_snapshots_health_score_range;
alter table scan_snapshots
  add  constraint scan_snapshots_health_score_range
       check (health_score is null or (health_score between 0 and 100));

alter table scan_snapshots
  drop constraint if exists scan_snapshots_status_check;
alter table scan_snapshots
  add  constraint scan_snapshots_status_check
       check (status is null or status in ('complete', 'partial', 'failed'));

-- Expand source to accept BOTH the V1 event-type vocabulary (existing rows
-- have these values; the monitoring cron + signup flow still write them)
-- AND the V2 platform-source vocabulary the brief specifies.
alter table scan_snapshots drop constraint if exists scan_snapshots_source_check;
alter table scan_snapshots
  add constraint scan_snapshots_source_check
      check (source in (
        'signup_scan', 'grace_rescan', 'scheduled_rescan', 'manual_rescan',
        'apple_music', 'spotify', 'youtube', 'musicbrainz'
      ));

-- Backfill the 3 live rows. All have payload->subject->{artistId,artistName}.
update scan_snapshots
   set artist_id      = coalesce(artist_id,      payload->'subject'->>'artistId'),
       artist_name    = coalesce(artist_name,    payload->'subject'->>'artistName'),
       scan_number    = coalesce(scan_number,    sequence_number),
       scanned_at     = coalesce(scanned_at,     created_at),
       canonical_data = coalesce(canonical_data, payload),
       status         = coalesce(status,         'complete')
 where artist_id is null
    or scan_number is null
    or scanned_at is null
    or canonical_data is null
    or status is null;

-- Now safe to give scanned_at a default for new V2 inserts. (Deferred until
-- after backfill so existing rows keep their original created_at value above,
-- rather than being filled with the migration's runtime now() at ADD time.)
alter table scan_snapshots alter column scanned_at set default now();

-- V2 access path: latest snapshots per (user, artist).
create index if not exists scan_snapshots_user_artist_scanned_idx
  on scan_snapshots (user_id, artist_id, scanned_at desc);

-- RLS — the existing SELECT policy stays; add the write policies the brief
-- requires ("users can only read and write their own rows").
drop policy if exists scan_snapshots_insert_own on scan_snapshots;
create policy scan_snapshots_insert_own on scan_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists scan_snapshots_update_own on scan_snapshots;
create policy scan_snapshots_update_own on scan_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists scan_snapshots_delete_own on scan_snapshots;
create policy scan_snapshots_delete_own on scan_snapshots
  for delete using (auth.uid() = user_id);


-- ─── 2. monitoring_alerts — drop V1 shape, create V2 shape ──────────────────

-- The pre-existing monitoring_alerts (created in 20260510002945_phase1_paid_product)
-- was billing-anchored (subscription_id + alert_tier/alert_status enums) and has
-- 0 rows and no application code references. V2 is per-user, scan-anchored.
drop table if exists monitoring_alerts cascade;
drop type  if exists alert_tier;
drop type  if exists alert_status;

create table monitoring_alerts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id)       on delete cascade,
  artist_id         text        not null,
  artist_name       text        not null,
  scan_id           uuid        not null references scan_snapshots(id)   on delete cascade,
  previous_scan_id  uuid                 references scan_snapshots(id)   on delete set null,
  detected_at       timestamptz not null default now(),
  change_type       text        not null check (change_type in (
                      'territory_loss', 'territory_gain',
                      'isrc_dropped',   'isrc_added',     'isrc_mismatch',
                      'release_removed','release_added',
                      'profile_missing',
                      'video_removed',  'video_added',
                      'metadata_changed',
                      'baseline_established'
                    )),
  severity          text        not null check (severity in (
                      'action_needed', 'monitor', 'positive', 'informational'
                    )),
  title             text        not null,
  detail            text        not null,
  track_name        text,
  territory         text,
  isrc              text,
  platform          text,
  resolved          boolean     not null default false,
  resolved_at       timestamptz
);

alter table monitoring_alerts enable row level security;

create policy monitoring_alerts_select_own on monitoring_alerts
  for select using (auth.uid() = user_id);
create policy monitoring_alerts_insert_own on monitoring_alerts
  for insert with check (auth.uid() = user_id);
create policy monitoring_alerts_update_own on monitoring_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy monitoring_alerts_delete_own on monitoring_alerts
  for delete using (auth.uid() = user_id);

create index monitoring_alerts_user_artist_detected_idx
  on monitoring_alerts (user_id, artist_id, detected_at desc);
create index monitoring_alerts_user_resolved_severity_idx
  on monitoring_alerts (user_id, resolved, severity);


-- ─── 3. monitoring_subscriptions — new ──────────────────────────────────────

create table monitoring_subscriptions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  artist_id       text        not null,
  artist_name     text        not null,
  scan_frequency  text        not null check (scan_frequency in ('weekly', 'monthly')),
  last_scanned_at timestamptz,
  next_scan_at    timestamptz,
  active          boolean     not null default true,
  created_at      timestamptz not null default now()
);

alter table monitoring_subscriptions enable row level security;

create policy monitoring_subscriptions_select_own on monitoring_subscriptions
  for select using (auth.uid() = user_id);
create policy monitoring_subscriptions_insert_own on monitoring_subscriptions
  for insert with check (auth.uid() = user_id);
create policy monitoring_subscriptions_update_own on monitoring_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy monitoring_subscriptions_delete_own on monitoring_subscriptions
  for delete using (auth.uid() = user_id);

create index monitoring_subscriptions_user_active_next_idx
  on monitoring_subscriptions (user_id, active, next_scan_at);

commit;
