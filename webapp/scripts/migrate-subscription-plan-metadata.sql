-- Add optional JSON metadata to subscription_plan (membership tier / interval, etc.)
ALTER TABLE subscription_plan
  ADD COLUMN IF NOT EXISTS metadata jsonb;
