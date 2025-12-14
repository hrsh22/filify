import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  githubId: integer('github_id').unique().notNull(),
  githubUsername: text('github_username').notNull(),
  githubEmail: text('github_email'),
  githubToken: text('github_token').notNull(), // encrypted
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  repoName: text('repo_name').notNull(),
  repoUrl: text('repo_url').notNull(),
  repoBranch: text('repo_branch').notNull().default('main'),
  autoDeployBranch: text('auto_deploy_branch').notNull().default('main'),
  network: text('network').notNull().default('mainnet'), // 'mainnet' | 'sepolia'
  ensName: text('ens_name'), // Optional - null means IPFS-only deployment
  ensOwnerAddress: text('ens_owner_address'), // Required if ensName is set
  ethereumRpcUrl: text('ethereum_rpc_url'), // Required if ensName is set
  buildCommand: text('build_command'),
  outputDir: text('output_dir'),
  frontendDir: text('frontend_dir'),
  webhookEnabled: integer('webhook_enabled', { mode: 'boolean' }).notNull().default(false),
  webhookSecret: text('webhook_secret'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // includes pending_build & pending_upload states
  triggeredBy: text('triggered_by'),
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  buildLog: text('build_log'),
  ipfsCid: text('ipfs_cid'),
  ensTxHash: text('ens_tx_hash'),
  errorMessage: text('error_message'),
  buildArtifactsPath: text('build_artifacts_path'),
  carRootCid: text('car_root_cid'),
  carFilePath: text('car_file_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  deployments: many(deployments),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));




