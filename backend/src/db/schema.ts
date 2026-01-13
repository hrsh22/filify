import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  walletAddress: text('wallet_address').primaryKey(),
  ensName: text('ens_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const githubInstallations = sqliteTable('github_installations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.walletAddress, { onDelete: 'cascade' }),
  installationId: integer('installation_id').notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type').notNull(),
  accountAvatarUrl: text('account_avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.walletAddress, { onDelete: 'cascade' }),
  installationId: text('installation_id').references(() => githubInstallations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  repoUrl: text('repo_url').notNull(),
  repoBranch: text('repo_branch').notNull().default('main'),
  autoDeployBranch: text('auto_deploy_branch').notNull().default('main'),
  network: text('network').notNull().default('mainnet'),
  ensName: text('ens_name'),
  ensOwnerAddress: text('ens_owner_address'),
  ethereumRpcUrl: text('ethereum_rpc_url'),
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
  status: text('status').notNull(),
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
  githubInstallations: many(githubInstallations),
}));

export const githubInstallationsRelations = relations(githubInstallations, ({ one, many }) => ({
  user: one(users, {
    fields: [githubInstallations.userId],
    references: [users.walletAddress],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.walletAddress],
  }),
  installation: one(githubInstallations, {
    fields: [projects.installationId],
    references: [githubInstallations.id],
  }),
  deployments: many(deployments),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));
