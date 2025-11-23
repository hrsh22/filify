import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function applyMigrations() {
  const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/dev.db';
  const isTurso = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://');

  // Create database connection
  let db: any;
  let client: any;
  let executeQuery: (sql: string, params?: any[]) => Promise<any>;
  let executeRaw: (sql: string) => Promise<void>;
  let executeInsert: (sql: string, params: any[]) => Promise<void>;

  if (isTurso) {
    // Use Turso/libSQL client
    const { createClient } = require('@libsql/client');
    client = createClient({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    executeQuery = async (sql: string, params?: any[]) => {
      const result = await client.execute({
        sql,
        args: params || [],
      });
      return result.rows;
    };

    executeRaw = async (sql: string) => {
      // Turso doesn't support multiple statements in one call
      // Split by semicolons and execute each statement separately
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          await client.execute(statement);
        }
      }
    };

    executeInsert = async (sql: string, params: any[]) => {
      await client.execute({
        sql,
        args: params,
      });
    };

    console.log('✓ Connected to Turso database');
  } else {
    // Use local SQLite with better-sqlite3
    const Database = require('better-sqlite3');
    const dbPath = databaseUrl.replace('sqlite:', '');
    const dbDir = path.dirname(dbPath);

    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✓ Created data directory');
    }

    db = new Database(dbPath);

    executeQuery = async (sql: string, params?: any[]) => {
      if (params && params.length > 0) {
        return db.prepare(sql).all(...params);
      }
      return db.prepare(sql).all();
    };

    executeRaw = async (sql: string) => {
      db.exec(sql);
    };

    executeInsert = async (sql: string, params: any[]) => {
      db.prepare(sql).run(...params);
    };

    console.log('✓ Connected to local SQLite database');
  }

  // Automatically discover migration files in order
  const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');
  const allFiles = fs.readdirSync(migrationsDir);
  const migrationFiles = allFiles
    .filter((file) => file.endsWith('.sql') && !file.startsWith('.'))
    .sort(); // Sort alphabetically to ensure correct order

  if (migrationFiles.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }

  console.log(`🔄 Found ${migrationFiles.length} migration(s) to apply...`);
  console.log(`   ${migrationFiles.join(', ')}\n`);

  console.log('🔄 Applying migrations...');

  try {
    // Create migrations table if it doesn't exist
    await executeRaw(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER
      );
    `);

    // Apply each migration
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(process.cwd(), 'drizzle', 'migrations', migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Check if migration already applied
      const hash = migrationFile.replace('.sql', '');
      const existing = await executeQuery('SELECT id FROM __drizzle_migrations WHERE hash = ?', [hash]);

      if (existing && existing.length > 0) {
        console.log(`⏭️  Skipping ${migrationFile} (already applied)`);
        continue;
      }

      // Split by statement-breakpoint and execute each statement
      const statementBlocks = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);

      for (const block of statementBlocks) {
        if (block.trim()) {
          if (isTurso) {
            // For Turso, split by semicolons and execute each statement separately
            const statements = block
              .split(';')
              .map(s => s.trim())
              .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
              if (statement.trim()) {
                await client.execute(statement);
              }
            }
          } else {
            // For local SQLite, execute the whole block (can handle multiple statements)
            await executeRaw(block);
          }
        }
      }

      // Record migration
      await executeInsert('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [hash, Date.now()]);
      console.log(`✓ Applied ${migrationFile}`);
    }

    console.log('✓ All migrations applied successfully');

    // Verify database was created (only for local SQLite)
    if (!isTurso) {
      const dbPath = databaseUrl.replace('sqlite:', '');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        console.log(`✓ Database created at: ${dbPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    } else {
      console.log('✓ Turso database migrations completed');
    }
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    if (!isTurso && db) {
      db.close();
    }
    if (isTurso && client) {
      client.close();
    }
  }

  console.log('\n✅ Database setup complete!');
}

applyMigrations().catch((error) => {
  console.error('❌ Failed to run migrations:');
  console.error(error);
  process.exit(1);
});
