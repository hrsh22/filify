ALTER TABLE `projects` ADD `frontend_dir` text;--> statement-breakpoint
ALTER TABLE `deployments` DROP COLUMN `filecoin_piece_cid`;--> statement-breakpoint
ALTER TABLE `deployments` DROP COLUMN `filecoin_tx_hash`;--> statement-breakpoint
ALTER TABLE `deployments` DROP COLUMN `filecoin_data_set_id`;--> statement-breakpoint
ALTER TABLE `deployments` DROP COLUMN `filecoin_provider_id`;--> statement-breakpoint
ALTER TABLE `deployments` DROP COLUMN `ens_payload`;