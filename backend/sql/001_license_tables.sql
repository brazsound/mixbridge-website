-- License & subscription tables for Mix Bridge
-- Run this in Supabase SQL Editor (or any PostgreSQL)

-- Paddle subscriptions (populated by webhooks)
CREATE TABLE IF NOT EXISTS paddle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_email ON paddle_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_paddle_subscriptions_subscription_id ON paddle_subscriptions(subscription_id);

-- Email allowlist for free access (beta testers, partners)
CREATE TABLE IF NOT EXISTS free_access_emails (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);
