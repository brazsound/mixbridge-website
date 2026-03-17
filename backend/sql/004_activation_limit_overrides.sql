-- Per-email/per-subscription activation limit overrides
-- Run after 003_free_access_activations.sql
--
-- Give someone more devices than their tier/default allows:
--
-- NFR:  UPDATE free_access_emails SET activation_limit = 10 WHERE email = 'partner@studio.com';
-- Paid: UPDATE paddle_subscriptions SET activation_limit = 5 WHERE email = 'customer@example.com';
--
-- NFR: default 3, can override per email (e.g. 5, 10 for special partners)
ALTER TABLE free_access_emails
  ADD COLUMN IF NOT EXISTS activation_limit INTEGER DEFAULT 3 CHECK (activation_limit > 0 AND activation_limit <= 100);

-- Paid: NULL = use tier limit (solo=1, pro=3, team=10); when set, overrides tier
ALTER TABLE paddle_subscriptions
  ADD COLUMN IF NOT EXISTS activation_limit INTEGER CHECK (activation_limit IS NULL OR (activation_limit > 0 AND activation_limit <= 100));
