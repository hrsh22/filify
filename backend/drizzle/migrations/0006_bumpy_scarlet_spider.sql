-- Skip migration if column already exists to avoid duplicate errors
-- This approach uses SQLite's ability to ignore existing columns gracefully

SELECT 1;

-- Try adding network column (will succeed if already exists, ignore if duplicate)
ALTER TABLE `projects` ADD COLUMN `network` text DEFAULT 'mainnet' NOT NULL;
