import { env } from './env';
import * as schema from '../db/schema';
import path from 'path';
import fs from 'fs';

// Check if using Turso (libSQL) or local SQLite
const isTurso = env.DATABASE_URL.startsWith('libsql://') || env.DATABASE_URL.startsWith('https://');

let db: any;

if (isTurso) {
  // Use Turso/libSQL client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/libsql');
  
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
  
  db = drizzle(client, { schema });
} else {
  // Use local SQLite with better-sqlite3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  
  const dbPath = env.DATABASE_URL.replace('sqlite:', '');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  db = drizzle(sqlite, { schema });
}

export { db };




