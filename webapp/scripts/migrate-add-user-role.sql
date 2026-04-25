-- Migration: Add role column to user table
-- Run this BEFORE deploying the code that references the role column.
--
-- The column defaults to 'user' so all existing users get the default role.
-- After migration, set admin roles via:
--   UPDATE "user" SET role = 'admin' WHERE email IN ('admin1@example.com', 'admin2@example.com');
--
-- Or use the seed-admin-user.ts script.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

-- Optional: Create an index for admin role lookups
CREATE INDEX IF NOT EXISTS idx_user_role ON "user" ("role") WHERE "role" != 'user';
