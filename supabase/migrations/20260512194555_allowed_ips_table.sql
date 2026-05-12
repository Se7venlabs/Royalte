-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Allowed IPs (rate-limit bypass)
--
-- Adds public.allowed_ips: IPs in this table skip ALL rate-limit blocking
-- (both blocked_ips lookups and per-window enforcement). Counters still
-- tick for log visibility — see api/_lib/rate-limit.js for the read path.
--
-- Populated manually via SQL in the Supabase dashboard. No code path
-- writes to this table. Read-only via the public.is_ip_allowed RPC.
--
-- Design choices:
--   - expires_at nullable: NULL = permanent allowlist, timestamp = temporary
--   - RLS enabled, no policies — service_role bypasses RLS entirely, so
--     anon/authenticated cannot read this table. Matches blocked_ips
--     security model.
--   - RPC is_ip_allowed(p_ip) returns boolean for atomic single round-trip
--     check (matches the rate_limit_check_and_increment pattern from
--     20260511163847_rate_limit_rpc.sql).
--
-- Idempotent (create if not exists, create or replace function). Safe to
-- re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.allowed_ips (
  ip         text        primary key,
  label      text,
  added_at   timestamptz not null default now(),
  expires_at timestamptz
);

-- RLS: service_role only. No policies — anon/authenticated have no read access.
alter table public.allowed_ips enable row level security;

-- Fast lookup by IP. Primary key already covers this, but having a named
-- index makes intent explicit and matches the blocked_ips pattern.
create index if not exists allowed_ips_ip_idx
  on public.allowed_ips (ip);

-- Partial index for expiration cleanup. Only indexes rows with an actual
-- expiry, so the permanent-allowlist majority stays out of the index.
create index if not exists allowed_ips_expires_at_idx
  on public.allowed_ips (expires_at)
  where expires_at is not null;

-- ── RPC: is_ip_allowed ───────────────────────────────────────────────────────
-- Returns true iff p_ip exists in allowed_ips AND either has no expiry or
-- has not expired yet. Single round-trip from the Node client, no RLS
-- gymnastics needed (SECURITY DEFINER runs as the function owner).
create or replace function public.is_ip_allowed(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select exists(
    select 1
    from public.allowed_ips
    where ip = p_ip
      and (expires_at is null or expires_at > now())
  ) into v_exists;
  return v_exists;
end;
$$;

-- Lock down EXECUTE so only service_role can call this. anon/authenticated
-- must not be able to probe the allowlist surface.
revoke all      on function public.is_ip_allowed(text) from public;
revoke all      on function public.is_ip_allowed(text) from anon;
revoke all      on function public.is_ip_allowed(text) from authenticated;
grant  execute  on function public.is_ip_allowed(text) to service_role;

commit;
