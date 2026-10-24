-- A permanent record of every deleted account (customers and admins) and the Stripe subscription it
-- had. Written in the same transaction as the deletion. It holds no documents or extracted data:
-- just enough to answer billing questions and disputes and to keep track of churn. No foreign keys:
-- the account it describes no longer exists. Idempotent like the others.

CREATE TABLE IF NOT EXISTS deletedaccount (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  username VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  plan VARCHAR,
  account_created_at TIMESTAMPTZ,
  deleted_at TIMESTAMP NOT NULL,
  deleted_by VARCHAR NOT NULL,
  deleted_by_admin_id VARCHAR,
  deleted_by_admin_username VARCHAR,
  lifetime_documents INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR,
  stripe_subscription_id VARCHAR,
  subscription_status_at_deletion VARCHAR,
  subscription_status VARCHAR,
  current_period_end TIMESTAMP,
  billing_cancelled_at TIMESTAMP,
  updated_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_deletedaccount_user_id ON deletedaccount (user_id);
CREATE INDEX IF NOT EXISTS ix_deletedaccount_deleted_at ON deletedaccount (deleted_at);
CREATE INDEX IF NOT EXISTS ix_deletedaccount_stripe_subscription_id ON deletedaccount (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS ix_deletedaccount_stripe_customer_id ON deletedaccount (stripe_customer_id);
