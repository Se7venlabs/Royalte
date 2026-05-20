-- ============================================================================
-- monitoring_subscriptions — UNIQUE (user_id, artist_id)
--
-- Brief 003 wires the scan-write path to upsert into monitoring_subscriptions
-- using ON CONFLICT (user_id, artist_id). The constraint must exist or the
-- upsert can't target a conflict target.
--
-- Idempotent: bail if a constraint with the same column set already exists.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'monitoring_subscriptions'
      and c.contype = 'u'
      and (
        select array_agg(attname order by k.ord)
        from unnest(c.conkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
      ) = array['user_id'::name, 'artist_id'::name]
  ) then
    alter table monitoring_subscriptions
      add constraint monitoring_subscriptions_user_artist_key
      unique (user_id, artist_id);
  end if;
end$$;
