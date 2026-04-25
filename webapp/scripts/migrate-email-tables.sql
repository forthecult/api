-- Email foundation tables (run after drizzle-kit push or alongside first deploy).
-- psql $DATABASE_URL -f webapp/scripts/migrate-email-tables.sql
-- Then: psql $DATABASE_URL -f webapp/scripts/migrate-enable-rls-auth-tables.sql (includes RLS for these tables)

CREATE TABLE IF NOT EXISTS public.email_event (
  id text PRIMARY KEY,
  resend_id text,
  user_id text REFERENCES public."user"(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  kind text NOT NULL,
  subject text,
  status text NOT NULL,
  error_message text,
  correlation_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_event_to_email_created_at_idx ON public.email_event (to_email, created_at);
CREATE INDEX IF NOT EXISTS email_event_user_id_created_at_idx ON public.email_event (user_id, created_at);
CREATE INDEX IF NOT EXISTS email_event_resend_id_idx ON public.email_event (resend_id);

CREATE TABLE IF NOT EXISTS public.email_suppression (
  email text PRIMARY KEY,
  reason text NOT NULL,
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscriber (
  email text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  confirmation_token_hash text,
  source text,
  ip_at_signup text,
  user_agent_at_signup text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  resend_contact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_funnel_enrollment (
  id text PRIMARY KEY,
  email text NOT NULL,
  user_id text REFERENCES public."user"(id) ON DELETE SET NULL,
  funnel text NOT NULL,
  last_step_sent integer NOT NULL DEFAULT 0,
  next_send_at timestamptz NOT NULL,
  experiment_variant text,
  context jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_funnel_enrollment_next_send_idx
  ON public.email_funnel_enrollment (next_send_at, completed);
CREATE INDEX IF NOT EXISTS email_funnel_enrollment_email_funnel_idx
  ON public.email_funnel_enrollment (email, funnel);
