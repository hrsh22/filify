CREATE TABLE "deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by" text,
	"commit_sha" text,
	"commit_message" text,
	"build_log" text,
	"ipfs_cid" text,
	"ens_tx_hash" text,
	"error_message" text,
	"build_artifacts_path" text,
	"car_root_cid" text,
	"car_file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"account_avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" text,
	"name" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"repo_url" text NOT NULL,
	"repo_branch" text DEFAULT 'main' NOT NULL,
	"auto_deploy_branch" text DEFAULT 'main' NOT NULL,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"ens_name" text,
	"ens_owner_address" text,
	"ethereum_rpc_url" text,
	"build_command" text,
	"output_dir" text,
	"frontend_dir" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"ens_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_users_wallet_address_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("wallet_address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_wallet_address_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("wallet_address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;