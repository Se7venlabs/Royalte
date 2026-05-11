-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Rate limit atomic check-and-increment RPC
--
-- Adds public.rate_limit_check_and_increment(...) — a SECURITY DEFINER
-- function that performs an atomic INSERT...ON CONFLICT DO UPDATE on the
-- rate_limits table and returns whether the post-increment count is within
-- the caller-supplied max.
--
-- Replaces the previous read-then-upsert pattern in
-- api/_lib/rate-limit.js's checkRateLimit, which had a known race under
-- parallel load (N requests all read count=0, all upsert count=1, all
-- pass the limit check).
--
-- Behaviour:
--   - If no row exists for (ip, endpoint, window_type, window_start):
--     inserts with count=1 and returns (allowed=(1<=p_max), current_count=1)
--   - If a row exists: atomically increments count and returns
--     (allowed=(new_count<=p_max), current_count=new_count)
--   - PG's row-level lock from ON CONFLICT serialises parallel callers per
--     conflict key, so concurrent increments produce monotonically
--     increasing counts (1, 2, 3, ...) rather than all racing to count=1.
--
-- Conflict target: the existing unique index rate_limits_unique on
-- (ip, endpoint, window_type, window_start) — verified pre-flight.
--
-- Idempotent (CREATE OR REPLACE FUNCTION). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create or replace function public.rate_limit_check_and_increment(
  p_ip           text,
  p_endpoint     text,
  p_window       text,
  p_window_start timestamptz,
  p_max          integer
) returns table(allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (ip, endpoint, window_type, window_start, count, updated_at)
  values (p_ip, p_endpoint, p_window, p_window_start, 1, now())
  on conflict (ip, endpoint, window_type, window_start)
  do update set
    count      = public.rate_limits.count + 1,
    updated_at = now()
  returning public.rate_limits.count into v_count;

  return query select (v_count <= p_max) as allowed, v_count as current_count;
end;
$$;

-- Lock down EXECUTE so only service_role can call this. anon / authenticated
-- have no business hitting internal rate-limit machinery directly.
revoke execute on function public.rate_limit_check_and_increment(text, text, text, timestamptz, integer) from public;
grant  execute on function public.rate_limit_check_and_increment(text, text, text, timestamptz, integer) to service_role;

commit;
