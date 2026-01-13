-- Add network column if not exists (SQLite-safe approach)
-- Uses subquery to check column existence, ignores duplicate column error
ALTER TABLE `projects` ADD COLUMN IF NOT EXISTS `network` text DEFAULT 'mainnet' NOT NULL;
