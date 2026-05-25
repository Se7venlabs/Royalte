-- ============================================================================
-- Royaltē OS — Brief 010: pg_cron scan scheduler
-- ----------------------------------------------------------------------------
-- Wires Postgres's own cron to fire automated scans for every active row in
-- monitoring_subscriptions on its scheduled cadence. The hourly tick runs
-- a SECURITY DEFINER function that:
--   1. Reads the cron secret from public.cron_config (B2 — plain table)
--   2. Pulls every active subscription where next_scan_at <= now()
--   3. Pushes each due row's next_scan_at forward by 1 hour BEFORE firing
--      (lock-out window — prevents double-fire on slow scans / re-tick races)
--   4. Calls net.http_post('https://www.royalte.ai/api/cron/scan-subscription',
--      ...) async per due row. The Vercel endpoint runs the scan +
--      persistOSScanSnapshot, which upserts the subscription's next_scan_at
--      back to now()+7 days on success (failure → lock-out elapses naturally).
--
-- Decisions taken before writing this migration:
--   B2  — cron secret stored in a plain public.cron_config table (no Vault)
--   C1  — V1 /api/cron/rescan Vercel cron left untouched (parallel pipeline)
--   tick — hourly (0 * * * *)
-- ============================================================================

-- ─── 1. Extensions ─────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ─── 2. cron_config (secret + future config) ──────────────────────────────

create table if not exists public.cron_config (
  id          uuid        primary key default gen_random_uuid(),
  key         text        not null unique,
  value       text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS on — no policies — locks it down from anon/authenticated. The
-- trigger_due_v2_scans() function reads via SECURITY DEFINER (bypasses RLS).
alter table public.cron_config enable row level security;

comment on table public.cron_config is
  'Brief 010 (B2) — config + secrets for pg_cron triggered work. RLS-locked; only SECURITY DEFINER functions read it. Founder seeds with: INSERT INTO public.cron_config (key, value) VALUES (''cron_secret'', ''<value of CRON_SECRET from Vercel env>'') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();';


-- ─── 3. trigger_due_v2_scans() — the pg_cron tick body ────────────────────

create or replace function public.trigger_due_v2_scans()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_secret text;
  v_url    text := 'https://www.royalte.ai/api/cron/scan-subscription';
  v_sub    record;
  v_fired  integer := 0;
begin
  -- Pull the cron secret. Without it, no scans fire. The founder seeds
  -- this once after migration via the INSERT in the cron_config comment.
  select value into v_secret
    from public.cron_config
   where key = 'cron_secret';

  if v_secret is null then
    raise warning '[pg-cron] cron_secret not set in cron_config; no scans fired';
    return 0;
  end if;

  -- Batch cap — keeps one tick bounded (Brief 010 doesn't expect more
  -- than a handful of due rows per hour at current scale; cap protects
  -- against runaway if scheduler ever falls behind).
  for v_sub in
    select id, user_id, artist_id, artist_name, next_scan_at
      from public.monitoring_subscriptions
     where active = true
       and (next_scan_at is null or next_scan_at <= now())
     order by next_scan_at nulls first
     limit 25
  loop
    -- Lock-out: push next_scan_at forward by 1 hour BEFORE the HTTP fire.
    -- If the Vercel scan succeeds, persistOSScanSnapshot upserts
    -- next_scan_at to now()+7d (overrides the lock-out). If it fails or
    -- times out, the lock-out elapses naturally and the next hourly
    -- tick can retry without re-firing immediately.
    update public.monitoring_subscriptions
       set next_scan_at = now() + interval '1 hour'
     where id = v_sub.id;

    -- Async fire-and-forget. pg_net returns a request_id immediately and
    -- delivers the POST in the background; this function does not await
    -- the response, so a slow Vercel scan doesn't hold the cron tick.
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('subscription_id', v_sub.id),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 60000
    );

    v_fired := v_fired + 1;
  end loop;

  return v_fired;
end;
$$;

comment on function public.trigger_due_v2_scans is
  'Brief 010 — pg_cron tick body. Picks due monitoring_subscriptions, advances each lock-out window, and async-fires /api/cron/scan-subscription per row via pg_net. Returns the number of fires.';


-- ─── 4. Schedule the hourly tick ──────────────────────────────────────────

-- Drop any pre-existing schedule with the same name first so this
-- migration is idempotent (re-runnable without "already scheduled" errors).
do $$
begin
  perform cron.unschedule('os-due-scans')
    where exists (select 1 from cron.job where jobname = 'os-due-scans');
end$$;

select cron.schedule(
  'os-due-scans',
  '0 * * * *',
  $cron$ select public.trigger_due_v2_scans(); $cron$
);
