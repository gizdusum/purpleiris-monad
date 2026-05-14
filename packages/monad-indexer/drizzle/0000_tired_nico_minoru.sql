CREATE TABLE "dispute_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"iris_response" jsonb NOT NULL,
	"tool_calls" jsonb NOT NULL,
	"data_class_labels" jsonb NOT NULL,
	"description" text NOT NULL,
	"expected_behavior" text,
	"category" text NOT NULL,
	"reporter_address" text,
	"status" text DEFAULT 'automated_triage' NOT NULL,
	"triage_result" jsonb DEFAULT 'null'::jsonb,
	"admin_response" text,
	"admin_responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epoch_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"validator_id" text NOT NULL,
	"epoch" integer NOT NULL,
	"blocks_proposed" integer DEFAULT 0 NOT NULL,
	"blocks_missed" integer DEFAULT 0 NOT NULL,
	"success_rate" real NOT NULL,
	"voting_power" bigint NOT NULL,
	"delegator_count" integer DEFAULT 0 NOT NULL,
	"scheduled_downtime" boolean DEFAULT false NOT NULL,
	"snapshot_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"ts" timestamp NOT NULL,
	"cpu_percent" real,
	"mem_percent" real,
	"disk_percent" real,
	"block_height" bigint,
	"consensus_lag_ms" integer,
	"execution_lag_ms" integer,
	"peer_count" integer,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "telemetry_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"validator_id" text,
	"public_key" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validator_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"bio" text,
	"logo_url" text,
	"website" text,
	"twitter_handle" text,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"siwe_address" text,
	"siwe_expires_at" timestamp,
	"notes" jsonb DEFAULT '[]'::jsonb,
	"maintenance_windows" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validators" (
	"id" text PRIMARY KEY NOT NULL,
	"moniker" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"commission_bps" integer NOT NULL,
	"jailed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"staked_amount" bigint NOT NULL,
	"region" text,
	"infra_provider" text,
	"flag" text,
	"country" text,
	"slug" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epoch_snapshots" ADD CONSTRAINT "epoch_snapshots_validator_id_validators_id_fk" FOREIGN KEY ("validator_id") REFERENCES "public"."validators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_metrics" ADD CONSTRAINT "telemetry_metrics_node_id_telemetry_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."telemetry_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_nodes" ADD CONSTRAINT "telemetry_nodes_validator_id_validators_id_fk" FOREIGN KEY ("validator_id") REFERENCES "public"."validators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_tickets_status_idx" ON "dispute_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispute_tickets_created_at_idx" ON "dispute_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "epoch_snapshots_validator_epoch_idx" ON "epoch_snapshots" USING btree ("validator_id","epoch");--> statement-breakpoint
CREATE INDEX "epoch_snapshots_epoch_idx" ON "epoch_snapshots" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "epoch_snapshots_snapshot_at_idx" ON "epoch_snapshots" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "telemetry_metrics_node_ts_idx" ON "telemetry_metrics" USING btree ("node_id","ts");--> statement-breakpoint
CREATE INDEX "telemetry_metrics_ts_idx" ON "telemetry_metrics" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "telemetry_nodes_validator_idx" ON "telemetry_nodes" USING btree ("validator_id");--> statement-breakpoint
CREATE INDEX "validators_active_idx" ON "validators" USING btree ("active");--> statement-breakpoint
CREATE INDEX "validators_slug_idx" ON "validators" USING btree ("slug");