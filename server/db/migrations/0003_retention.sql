-- Retention schedule (lib/retention.ts), enforced daily by server/retention.ts. Idempotent.

-- Deletion records drop the email once it's past its retention period; the rest of the record stays
-- until it's deleted entirely.
ALTER TABLE deletedaccount ALTER COLUMN username DROP NOT NULL;
ALTER TABLE deletedaccount ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP;

-- The retention job selects by age.
CREATE INDEX IF NOT EXISTS ix_feedback_created_at ON feedback (created_at);
CREATE INDEX IF NOT EXISTS ix_stripeevent_created_at ON stripeevent (created_at);
CREATE INDEX IF NOT EXISTS ix_passwordresettoken_expires_at ON passwordresettoken (expires_at);
