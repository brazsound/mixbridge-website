-- Tier model and activation tracking
-- Run after 001_license_tables.sql

-- Add tier to paddle_subscriptions (solo, pro, team)
ALTER TABLE paddle_subscriptions
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'solo' CHECK (tier IN ('solo', 'pro', 'team'));

-- Activation limits per tier: solo=1, pro=3, team=10
-- Stored in app logic; tier column is source of truth

-- Track device activations per subscription
CREATE TABLE IF NOT EXISTS subscription_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL REFERENCES paddle_subscriptions(subscription_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_activations_subscription_id
  ON subscription_activations(subscription_id);
