import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/dev.db';
const dbPath = databaseUrl.replace('sqlite:', '');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('✓ Created data directory');
}

// Create database connection
const sqlite = new Database(dbPath);

// Migration files in order
const migrations = [
  '0000_wooden_kree.sql',
  '0001_ambitious_mister_sinister.sql',
  '0002_wallet_owned_ens.sql',
  '0003_backend_car.sql',
];

console.log('🔄 Applying migrations...');

try {
  // Create migrations table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER
    );
  `);

  // Apply each migration
  for (const migrationFile of migrations) {
    const migrationPath = path.join(process.cwd(), 'drizzle', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.log(`⚠️  Migration file not found: ${migrationFile}`);
      continue;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Check if migration already applied
    const hash = migrationFile.replace('.sql', '');
    const existing = sqlite.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(hash);

    if (existing) {
      console.log(`⏭️  Skipping ${migrationFile} (already applied)`);
      continue;
    }

    // Split by statement-breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        sqlite.exec(statement);
      }
    }

    // Record migration
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, Date.now());
    console.log(`✓ Applied ${migrationFile}`);
  }

  console.log('✓ All migrations applied successfully');

  // Verify database was created
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log(`✓ Database created at: ${dbPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  }
} catch (error) {
  console.error('❌ Migration failed:');
  console.error(error);
  process.exit(1);
} finally {
  sqlite.close();
}

console.log('\n✅ Database setup complete!');
