-- Per-activation display names for organizing machines
-- Run after 004_activation_limit_overrides.sql
--
-- First activation's name becomes the default for new activations.
-- Each activation can have its own name (e.g. "Studio A", "Home Laptop").

-- Per-activation display name: what this device is called
ALTER TABLE free_access_activations
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE subscription_activations
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Default name for new activations (from first activation)
ALTER TABLE free_access_emails
  ADD COLUMN IF NOT EXISTS default_display_name TEXT;

ALTER TABLE paddle_subscriptions
  ADD COLUMN IF NOT EXISTS default_display_name TEXT;
