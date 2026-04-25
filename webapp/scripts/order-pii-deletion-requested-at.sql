-- Optional: apply manually if not using `bun run db:push` for schema sync.
ALTER TABLE "order"
ADD COLUMN IF NOT EXISTS pii_deletion_requested_at timestamp;
