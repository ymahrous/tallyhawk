-- Account types, session revocation, brute-force lockout, admin tooling, contact form, billing
-- details, webhook idempotency and rate limiting. Idempotent like 0000: safe to re-run.

-- Accounts: `role` separates customers ('user') from staff ('admin'); an admin is never a customer.
-- `token_version` is embedded in every session token (`ver`) and bumped to revoke all of an
-- account's sessions (password change/reset, suspension, "sign out everywhere"). Brute-force
-- protection lives in `ratelimit` (keyed by the attempted username), not here, so a locked-out
-- response can't reveal whether an account exists.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'user';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_user_role ON "user" (role);

-- Documents: files now live at a per-user, unguessable storage path instead of the shared
-- uploaded filename. NULL on rows uploaded before this migration (their path is the filename).
ALTER TABLE document ADD COLUMN IF NOT EXISTS storage_path VARCHAR;

-- Subscriptions: billing-period details from Stripe.
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP;
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Feedback (incl. bug reports): triage state for the admin dashboard.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'new';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_note VARCHAR;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS page VARCHAR;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Password reset tokens are now stored as SHA-256 hashes, never in plain text. Outstanding
-- plain-text tokens (valid for at most an hour) simply stop matching.

CREATE TABLE IF NOT EXISTS contactmessage (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES "user" (id) ON DELETE SET NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  message VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'new',
  admin_note VARCHAR,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_contactmessage_status ON contactmessage (status);
CREATE INDEX IF NOT EXISTS ix_contactmessage_created_at ON contactmessage (created_at);

-- Every admin write is recorded here. Actor and target are denormalised (no foreign keys) so the
-- trail survives the deletion of either account.
CREATE TABLE IF NOT EXISTS auditlog (
  id VARCHAR PRIMARY KEY,
  actor_id VARCHAR,
  actor_username VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  target_type VARCHAR,
  target_id VARCHAR,
  target_label VARCHAR,
  details JSON,
  ip_hash VARCHAR,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_auditlog_created_at ON auditlog (created_at);
CREATE INDEX IF NOT EXISTS ix_auditlog_action ON auditlog (action);

-- Stripe event ids already handled, so retried or replayed webhooks are applied once.
CREATE TABLE IF NOT EXISTS stripeevent (
  id VARCHAR PRIMARY KEY,
  type VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- Fixed-window request counters shared by every server instance (server/rate-limit.ts). Keys hold
-- hashed client identifiers, never raw IP addresses.
CREATE TABLE IF NOT EXISTS ratelimit (
  key VARCHAR PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ratelimit_window_start ON ratelimit (window_start);
