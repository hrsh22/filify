import { env } from './env';
import * as schema from '../db/schema';
import path from 'path';
import fs from 'fs';

const isTurso = env.DATABASE_URL.startsWith('libsql://') || env.DATABASE_URL.startsWith('https://');

let db: any;

if (isTurso) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/libsql');

  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });

  db = drizzle(client, { schema });

  client.execute('PRAGMA foreign_keys = ON').catch((err: Error) => {
    console.error('Failed to enable foreign keys for Turso:', err.message);
  });
} else {
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
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });
}

export { db };




