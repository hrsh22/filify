ALTER TABLE deployments ADD `triggered_by` text;--> statement-breakpoint
ALTER TABLE deployments ADD `commit_sha` text;--> statement-breakpoint
ALTER TABLE deployments ADD `commit_message` text;--> statement-breakpoint
ALTER TABLE deployments ADD `build_artifacts_path` text;--> statement-breakpoint
ALTER TABLE projects ADD `auto_deploy_branch` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE projects ADD `webhook_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE projects ADD `webhook_secret` text;