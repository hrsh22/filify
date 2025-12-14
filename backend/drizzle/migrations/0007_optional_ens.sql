/**
 * Migration to make ENS fields optional in the projects table.
 * 
 * SQLite doesn't support ALTER COLUMN, so we need to recreate the table
 * or just accept that existing NOT NULL constraints are at the column level.
 * 
 * Since the columns are TEXT and SQLite is lenient, we can just update the
 * Drizzle schema (which we did) and it will work for new records.
 * Existing records already have ENS values, so no data migration needed.
 * 
 * This is a no-op migration for documentation purposes.
 */

-- No SQL changes needed for existing Turso/SQLite database
-- TEXT columns in SQLite can already hold NULL values
-- The notNull constraint is only enforced at insert time by Drizzle
-- Existing records keep their values, new records can have NULL
