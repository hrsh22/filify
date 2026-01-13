-- Create users table with wallet-based auth
CREATE TABLE IF NOT EXISTS `users` (
	`wallet_address` text PRIMARY KEY NOT NULL,
	`ens_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- Create github_installations table
CREATE TABLE IF NOT EXISTS `github_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` integer NOT NULL,
	`account_login` text NOT NULL,
	`account_type` text NOT NULL,
	`account_avatar_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`wallet_address`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index on github_installations
CREATE UNIQUE INDEX IF NOT EXISTS `github_installations_installation_id_unique` ON `github_installations` (`installation_id`);

-- Create projects table
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` text,
	`name` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`repo_url` text NOT NULL,
	`repo_branch` text DEFAULT 'main' NOT NULL,
	`auto_deploy_branch` text DEFAULT 'main' NOT NULL,
	`network` text DEFAULT 'mainnet' NOT NULL,
	`ens_name` text,
	`ens_owner_address` text,
	`ethereum_rpc_url` text,
	`build_command` text,
	`output_dir` text,
	`frontend_dir` text,
	`webhook_enabled` integer DEFAULT false NOT NULL,
	`webhook_secret` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`wallet_address`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installations`(`id`) ON UPDATE no action ON DELETE set null
);

-- Create deployments table
CREATE TABLE IF NOT EXISTS `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`triggered_by` text,
	`commit_sha` text,
	`commit_message` text,
	`build_log` text,
	`ipfs_cid` text,
	`ens_tx_hash` text,
	`error_message` text,
	`build_artifacts_path` text,
	`car_root_cid` text,
	`car_file_path` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
