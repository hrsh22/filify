import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  // Session
  SESSION_SECRET: z.string().min(32),

  // Database
  DATABASE_URL: z.string().default('sqlite:./data/dev.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(), // Required for Turso

  // Encryption (must be 64 character hex string for 32 bytes)
  ENCRYPTION_KEY: z.string().length(64),
  GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY: z.string().length(64),

  // Defaults
  DEFAULT_ETHEREUM_RPC: z.string().url().default(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`),

  // Build cleanup
  CLEANUP_BUILDS_ON_COMPLETE: z.string().default('true').transform((val) => val === 'true'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;




