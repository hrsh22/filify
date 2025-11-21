import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/dev.db';
const dbPath = databaseUrl.replace('sqlite:', '');

export default {
    schema: './src/db/schema.ts',
    out: './drizzle/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: dbPath,
    },
} satisfies Config;

