-- Run once against the Neon database before enabling the multi-platform UI.
-- PostgreSQL enum values are added without removing existing values or data.

ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'facebook';
ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'x';
ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'youtube';
ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'threads';
ALTER TYPE platform_name ADD VALUE IF NOT EXISTS 'pinterest';

ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'manual_action';

ALTER TABLE post_targets
  ADD COLUMN IF NOT EXISTS platform_caption TEXT;

CREATE INDEX IF NOT EXISTS idx_post_targets_platform_status
  ON post_targets(platform, status);
