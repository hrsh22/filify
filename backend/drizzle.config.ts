import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://localhost:5432/filify_development';

export default {
    schema: './src/db/schema.ts',
    out: './drizzle/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
    },
} satisfies Config;
