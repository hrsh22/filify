/**
 * Apply all pending SQL migrations from drizzle/migrations folder
 * Usage: npm run db:migrate:prod
 * 
 * This bypasses drizzle-kit which has issues with Turso authentication,
 * and applies migrations directly using @libsql/client.
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '../drizzle/migrations');
const MIGRATIONS_TABLE = '__drizzle_migrations';

async function main() {
    const url = process.env.DATABASE_URL;
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    if (!url) {
        console.error('❌ DATABASE_URL is not set');
        process.exit(1);
    }

    console.log('Connecting to:', url.substring(0, 40) + '...');

    const client = createClient({ url, authToken });

    try {
        // Create migrations tracking table if not exists
        await client.execute(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

        // Get already applied migrations
        const applied = await client.execute(`SELECT hash FROM ${MIGRATIONS_TABLE}`);
        const appliedHashes = new Set(applied.rows.map(r => r.hash));

        // Get all migration files
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            console.log('No migrations directory found');
            return;
        }

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('No migration files found');
            return;
        }

        let appliedCount = 0;
        for (const file of files) {
            const hash = file.replace('.sql', '');

            if (appliedHashes.has(hash)) {
                console.log(`⏭️  Skipping ${file} (already applied)`);
                continue;
            }

            console.log(`📦 Applying ${file}...`);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

            // Split by semicolon and execute each statement
            const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

            for (const stmt of statements) {
                await client.execute(stmt);
            }

            // Record migration
            await client.execute({
                sql: `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
                args: [hash, Date.now()]
            });

            console.log(`✅ Applied ${file}`);
            appliedCount++;
        }

        if (appliedCount === 0) {
            console.log('\n✨ All migrations already applied');
        } else {
            console.log(`\n✅ Applied ${appliedCount} migration(s)`);
        }
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

main();
