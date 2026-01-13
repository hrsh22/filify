import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  SESSION_SECRET: z.string().min(32),

  DATABASE_URL: z.string().default('sqlite:./data/dev.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),

  ENCRYPTION_KEY: z.string().length(64),
  GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY: z.string().length(64),

  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_NAME: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),

  ALCHEMY_KEY: z.string().min(1),
  DEFAULT_ETHEREUM_RPC: z.string().url().default(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`),
  THEGRAPH_API_KEY: z.string().min(1),

  CLEANUP_BUILDS_ON_COMPLETE: z.string().default('true').transform((val) => val === 'true'),

  FILECOIN_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid private key'),
  FILECOIN_RPC_URL: z.string().url().optional(),
  WARM_STORAGE_ADDRESS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
