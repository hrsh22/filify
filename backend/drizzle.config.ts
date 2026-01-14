import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://localhost:5432/filify_development';
const isProduction = process.env.NODE_ENV === 'production';

export default {
    schema: './src/db/schema.ts',
    out: './drizzle/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
    },
} satisfies Config;
