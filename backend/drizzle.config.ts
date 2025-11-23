import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/dev.db';
const isTurso = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://');

export default {
    schema: './src/db/schema.ts',
    out: './drizzle/migrations',
    dialect: 'sqlite',
    dbCredentials: isTurso
        ? {
              url: databaseUrl,
              authToken: process.env.DATABASE_AUTH_TOKEN,
          }
        : {
              url: databaseUrl.replace('sqlite:', ''),
          },
} satisfies Config;

