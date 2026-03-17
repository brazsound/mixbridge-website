-- NFR (free access) activation tracking - 3 devices per email
-- Run after 002_tier_activations.sql

CREATE TABLE IF NOT EXISTS free_access_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL REFERENCES free_access_emails(email) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, device_id)
);

CREATE INDEX IF NOT EXISTS idx_free_access_activations_email
  ON free_access_activations(email);
