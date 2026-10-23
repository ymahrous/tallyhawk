-- Tallyhawk schema. Idempotent: safe to run against a fresh database AND against one created by the
-- former FastAPI/SQLModel backend (which produced exactly these tables, names and constraints).
-- Applied by `npm run db:migrate` (scripts/db-migrate.mjs) and by the server test harness.

CREATE TABLE IF NOT EXISTS "user" (
  id VARCHAR PRIMARY KEY,
  username VARCHAR NOT NULL,
  hashed_password VARCHAR NOT NULL,
  plan VARCHAR NOT NULL DEFAULT 'free',
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_user_username ON "user" (username);

CREATE TABLE IF NOT EXISTS document (
  id VARCHAR PRIMARY KEY,
  filename VARCHAR NOT NULL,
  s3_url VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  quickbooks_synced BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  owner_id VARCHAR NOT NULL REFERENCES "user" (id),
  flags VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_document_owner_id ON document (owner_id);

CREATE TABLE IF NOT EXISTS vendor (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES "user" (id),
  canonical_name VARCHAR NOT NULL,
  aliases JSON,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (user_id, canonical_name)
);
CREATE INDEX IF NOT EXISTS ix_vendor_user_id ON vendor (user_id);
CREATE INDEX IF NOT EXISTS ix_vendor_canonical_name ON vendor (canonical_name);

CREATE TABLE IF NOT EXISTS extraction (
  id VARCHAR PRIMARY KEY,
  document_id VARCHAR NOT NULL REFERENCES document (id),
  extracted_data JSON,
  confidence_score DOUBLE PRECISION NOT NULL,
  category VARCHAR,
  vendor_id VARCHAR REFERENCES vendor (id),
  original_currency VARCHAR(3),
  original_amount DOUBLE PRECISION,
  converted_amount DOUBLE PRECISION,
  converted_currency VARCHAR(3),
  exchange_rate DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS ix_extraction_vendor_id ON extraction (vendor_id);

CREATE TABLE IF NOT EXISTS subscription (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES "user" (id),
  plan VARCHAR NOT NULL,
  stripe_customer_id VARCHAR UNIQUE,
  stripe_subscription_id VARCHAR UNIQUE,
  status VARCHAR NOT NULL,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_subscription_user_id ON subscription (user_id);

CREATE TABLE IF NOT EXISTS usagerecord (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES "user" (id),
  month TIMESTAMP NOT NULL,
  documents_processed INTEGER NOT NULL,
  UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS ix_usagerecord_user_id ON usagerecord (user_id);

CREATE TABLE IF NOT EXISTS quickbooksconnection (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES "user" (id),
  realm_id VARCHAR NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_quickbooksconnection_user_id ON quickbooksconnection (user_id);
CREATE INDEX IF NOT EXISTS ix_quickbooksconnection_realm_id ON quickbooksconnection (realm_id);

CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES "user" (id),
  type VARCHAR NOT NULL,
  message VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_feedback_user_id ON feedback (user_id);

CREATE TABLE IF NOT EXISTS passwordresettoken (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES "user" (id),
  token VARCHAR NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_passwordresettoken_user_id ON passwordresettoken (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_passwordresettoken_token ON passwordresettoken (token);
