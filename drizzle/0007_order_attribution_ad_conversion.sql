-- Acquisition: persist checkout attribution + idempotent ad CAPI stub marker.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS attribution_snapshot_json text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS ad_server_conversion_sent_at timestamp;

-- User preference: opt out of server-side ad CAPI forwarding (PostHog unchanged).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ad_platform_conversion_forwarding boolean NOT NULL DEFAULT true;
