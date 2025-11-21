import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { env } from './env';
import * as schema from '../db/schema';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dbPath = env.DATABASE_URL.replace('sqlite:', '');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });




