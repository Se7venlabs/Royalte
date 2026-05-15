-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block A Chunk 2: grant migrate_anonymous_scans to authenticated
--
-- Chunk 1 created migrate_anonymous_scans(text, uuid) as SECURITY DEFINER
-- with EXECUTE granted to service_role only. Chunk 2 calls this RPC from the
-- /auth/callback page using the user's authenticated session (anon key + JWT),
-- so the `authenticated` role needs EXECUTE.
--
-- Safe to grant: the function is SECURITY DEFINER, validates both inputs
-- (RAISE EXCEPTION on null/empty), and its UPDATE is scoped to rows matching
-- the supplied session_id where user_id IS NULL — it cannot reassign scans
-- already claimed by another account.
--
-- Also revokes EXECUTE from `anon`: Supabase default privileges granted the
-- anon role EXECUTE at function-create time (Chunk 1's `REVOKE … FROM public`
-- only drops the PUBLIC pseudo-role grant, not role-specific ones). An
-- unauthenticated caller has no business invoking account-migration logic, so
-- this scopes the RPC to authenticated + service_role only.
--
-- Idempotent (GRANT/REVOKE are no-ops if already in the target state).
-- Wrapped in begin/commit. Applied via psql over the Session Pooler per
-- CLAUDE.md.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

GRANT EXECUTE ON FUNCTION public.migrate_anonymous_scans(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.migrate_anonymous_scans(text, uuid) FROM anon;

commit;
