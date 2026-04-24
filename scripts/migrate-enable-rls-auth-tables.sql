-- Enable Row Level Security on every base table in the public schema.
--
-- Context:
--   Tables in schemas exposed to PostgREST (Supabase) raise a
--   `rls_disabled_in_public` advisor whenever RLS is disabled. The webapp
--   does NOT go through PostgREST; it connects directly via Supavisor as
--   the `postgres` role, which has BYPASSRLS = true. Enabling RLS with no
--   policies therefore has zero runtime effect on the app and simply blocks
--   PostgREST `anon`/`authenticated` access.
--
-- Usage:
--   Supabase:  already applied via the `enable_rls_on_public_tables`
--              migration (see supabase/migrations). This file is kept as
--              the canonical idempotent script for other Postgres targets.
--   psql:      psql "$DATABASE_URL" -f webapp/scripts/migrate-enable-rls-auth-tables.sql
--
-- The DO block is idempotent and automatically covers tables added in the
-- future, so there is no need to maintain an explicit table list here.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
  END LOOP;
END $$;
