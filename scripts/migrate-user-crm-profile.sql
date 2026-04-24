-- CRM profile fields on public.user (mirrors Better Auth additionalFields).
-- Run: bun run scripts/run-psql-migration.ts scripts/migrate-user-crm-profile.sql

ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS sex text;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS interest_tags text;
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS crm_notes text;
