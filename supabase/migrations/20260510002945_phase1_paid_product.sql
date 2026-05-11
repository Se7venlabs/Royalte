-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Phase 1 paid product schema
--
-- Adds:
--   - 8 enums (subscription_product_type, subscription_status,
--     monitoring_scan_type, monitoring_scan_status, alert_tier, alert_status,
--     drip_template, drip_status)
--   - public.set_updated_at() trigger function
--   - subscriptions table (with updated_at trigger)
--   - monitoring_scans table
--   - monitoring_alerts table
--   - drip_queue table
--   - audit_requests.subscription_id column (FK → subscriptions, ON DELETE SET NULL)
--
-- All wrapped in a single transaction. Idempotent throughout (re-runs are
-- no-ops): IF NOT EXISTS on tables/indexes/columns, CREATE OR REPLACE on the
-- function, DROP/CREATE on the trigger, and DO/EXCEPTION blocks on enums
-- (Postgres does not support IF NOT EXISTS on CREATE TYPE pre-PG14).
--
-- RLS: disabled on all new tables (Phase 1, enable in Phase 2 with auth).
--
-- Run manually in the Supabase SQL Editor on the royalte.ai project, or via
-- supabase CLI once the project is linked.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type subscription_product_type as enum ('audit_only', 'monitoring_monthly', 'monitoring_annual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type subscription_status as enum ('active', 'canceled', 'past_due', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type monitoring_scan_type as enum ('daily', 'deep');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type monitoring_scan_status as enum ('running', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type alert_tier as enum ('critical', 'notable', 'informational');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type alert_status as enum ('new', 'acknowledged', 'auto_resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type drip_template as enum ('drip_1_immediate', 'drip_2_day_2', 'drip_3_day_5', 'drip_4_day_10', 'critical_alert', 'weekly_report');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type drip_status as enum ('pending', 'sent', 'failed', 'canceled');
exception when duplicate_object then null;
end $$;

-- ── set_updated_at() trigger function ────────────────────────────────────────
-- Used by the subscriptions table to keep updated_at in sync on every UPDATE.
-- Only subscriptions has updated_at; monitoring_scans / monitoring_alerts /
-- drip_queue track their state via dedicated columns (completed_at, sent_at,
-- detected_at, resolved_at) rather than a single mutable timestamp.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── subscriptions ────────────────────────────────────────────────────────────
-- One row per Stripe checkout outcome.
--   product_type='audit_only'           → one-time purchase, no recurring.
--                                         stripe_subscription_id is NULL.
--                                         status transitions: active → completed.
--   product_type='monitoring_monthly'   → Stripe subscription, recurring.
--                                         current_period_end + cancel_at_period_end
--                                         track Stripe state.
--   product_type='monitoring_annual'    → same as monthly, annual cadence.
-- RLS: disabled (Phase 1, enable in Phase 2 with auth)
create table if not exists subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  email                    text not null,
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,                  -- nullable; null for audit_only
  product_type             subscription_product_type not null,
  status                   subscription_status not null,
  current_period_end       timestamptz,                  -- nullable; monitoring only
  cancel_at_period_end     boolean not null default false,
  artist_name              text not null,
  spotify_artist_url       text,
  audit_request_id         uuid references audit_requests(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_email_idx
  on subscriptions (email);

create index if not exists subscriptions_stripe_customer_id_idx
  on subscriptions (stripe_customer_id);

create index if not exists subscriptions_status_product_type_idx
  on subscriptions (status, product_type);

drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row
  execute function public.set_updated_at();

-- ── monitoring_scans ─────────────────────────────────────────────────────────
-- One row per scan run for an active monitoring subscription.
--   scan_type='daily' → lightweight pulse (no audit_scan_id).
--   scan_type='deep'  → full audit engine run; audit_scan_id links to the
--                       canonical audit_scans row produced.
-- ON DELETE CASCADE on subscription_id: scans for cancelled+deleted subs are
-- not useful to retain. audit_scan_id uses SET NULL so the deep scan record
-- survives engine-row purges.
-- RLS: disabled (Phase 1, enable in Phase 2 with auth)
create table if not exists monitoring_scans (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid not null references subscriptions(id) on delete cascade,
  scan_type         monitoring_scan_type not null,
  status            monitoring_scan_status not null default 'running',
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  audit_scan_id     uuid references audit_scans(id) on delete set null,
  findings          jsonb,
  score             integer,                              -- nullable; deep scans only
  error             text
);

create index if not exists monitoring_scans_subscription_scantype_completed_idx
  on monitoring_scans (subscription_id, scan_type, completed_at desc);

-- ── monitoring_alerts ────────────────────────────────────────────────────────
-- One row per detected change/issue. tier drives notification behavior:
--   critical       → tier 1, immediate email (cron picks up via partial index)
--   notable        → tier 2, batched into weekly report
--   informational  → tier 3, dashboard-only
-- email_sent_at is null until the cron sends a critical alert. Tier 2/3 stay
-- null forever (they're not emailed individually). status='auto_resolved' is
-- set when a follow-up scan confirms the issue is gone.
-- RLS: disabled (Phase 1, enable in Phase 2 with auth)
create table if not exists monitoring_alerts (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid not null references subscriptions(id) on delete cascade,
  scan_id           uuid references monitoring_scans(id) on delete set null,
  tier              alert_tier not null,
  category          text not null,
  title             text not null,
  detail            text not null,
  recovery_action   text,
  status            alert_status not null default 'new',
  email_sent_at     timestamptz,                          -- null for tier 2/3 or unsent tier 1
  detected_at       timestamptz not null default now(),
  resolved_at       timestamptz,
  metadata          jsonb
);

create index if not exists monitoring_alerts_subscription_idx
  on monitoring_alerts (subscription_id);

create index if not exists monitoring_alerts_subscription_status_idx
  on monitoring_alerts (subscription_id, status);

create index if not exists monitoring_alerts_subscription_tier_detected_idx
  on monitoring_alerts (subscription_id, tier, detected_at desc);

-- Partial index — cron lookup for unsent critical alerts. Hot path: every
-- N minutes the alert dispatcher scans for tier='critical' rows where
-- email_sent_at IS NULL.
create index if not exists monitoring_alerts_pending_critical_idx
  on monitoring_alerts (detected_at)
  where email_sent_at is null and tier = 'critical';

-- ── drip_queue ───────────────────────────────────────────────────────────────
-- Outbound email queue. Drips and triggered emails (critical alerts, weekly
-- reports) all queue here so a single cron worker can dispatch them.
-- subscription_id is SET NULL on sub deletion so a delivery audit trail
-- survives even if the subscription is deleted.
-- RLS: disabled (Phase 1, enable in Phase 2 with auth)
create table if not exists drip_queue (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  template          drip_template not null,
  subscription_id   uuid references subscriptions(id) on delete set null,
  payload           jsonb,
  scheduled_for     timestamptz not null,
  sent_at           timestamptz,
  status            drip_status not null default 'pending',
  attempts          integer not null default 0,
  error             text,
  created_at        timestamptz not null default now()
);

create index if not exists drip_queue_email_idx
  on drip_queue (email);

-- Partial index — cron lookup for due-and-pending sends. Hot path: every
-- minute the dispatcher scans for status='pending' rows where
-- scheduled_for <= now().
create index if not exists drip_queue_pending_scheduled_idx
  on drip_queue (scheduled_for)
  where status = 'pending';

-- ── audit_requests linkage ───────────────────────────────────────────────────
-- After Stripe checkout completes, the webhook ties the audit_requests row
-- (the form submission) to the subscriptions row. ON DELETE SET NULL: if a
-- subscription is purged, we keep the request history (free audits and
-- cancelled-then-deleted subs both legitimately leave NULL here).
alter table audit_requests
  add column if not exists subscription_id uuid references subscriptions(id) on delete set null;

create index if not exists audit_requests_subscription_id_idx
  on audit_requests (subscription_id)
  where subscription_id is not null;

commit;

-- =============================================================================
-- ROLLBACK (manual — do not run automatically)
-- =============================================================================
-- To reverse this migration, run the following in order. Order matters:
-- FK must drop before its referenced table; enums must drop after all
-- columns using them are gone.
--
-- BEGIN;
--
-- -- 1. Drop FK on audit_requests
-- ALTER TABLE audit_requests DROP COLUMN IF EXISTS subscription_id;
--
-- -- 2. Drop tables (reverse dependency order)
-- DROP TABLE IF EXISTS drip_queue CASCADE;
-- DROP TABLE IF EXISTS monitoring_alerts CASCADE;
-- DROP TABLE IF EXISTS monitoring_scans CASCADE;
-- DROP TABLE IF EXISTS subscriptions CASCADE;
--
-- -- 3. Drop enums (only after tables using them are gone)
-- DROP TYPE IF EXISTS drip_template;
-- DROP TYPE IF EXISTS drip_status;
-- DROP TYPE IF EXISTS alert_tier;
-- DROP TYPE IF EXISTS alert_status;
-- DROP TYPE IF EXISTS monitoring_scan_type;
-- DROP TYPE IF EXISTS monitoring_scan_status;
-- DROP TYPE IF EXISTS subscription_product_type;
-- DROP TYPE IF EXISTS subscription_status;
--
-- -- Note: pdf_render_status is NOT dropped — it predates this migration.
--
-- COMMIT;
-- =============================================================================
