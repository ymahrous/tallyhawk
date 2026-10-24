-- Retention anonymizes instead of deleting (lib/retention.ts): personal fields become NULL and the
-- anonymized remainder is kept. Idempotent.

ALTER TABLE deletedaccount ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE contactmessage ALTER COLUMN name DROP NOT NULL;
ALTER TABLE contactmessage ALTER COLUMN email DROP NOT NULL;
ALTER TABLE contactmessage ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE contactmessage ALTER COLUMN message DROP NOT NULL;
ALTER TABLE contactmessage ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP;

ALTER TABLE feedback ALTER COLUMN message DROP NOT NULL;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP;

ALTER TABLE auditlog ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS ix_auditlog_target_id ON auditlog (target_id);
