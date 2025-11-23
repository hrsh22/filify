ALTER TABLE projects ADD `ens_owner_address` text DEFAULT '0x0000000000000000000000000000000000000000' NOT NULL;--> statement-breakpoint
ALTER TABLE projects DROP COLUMN `ens_private_key`;--> statement-breakpoint


