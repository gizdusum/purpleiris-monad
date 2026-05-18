import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  real,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// ── Validators ────────────────────────────────────────────────────────────────
export const validators = pgTable(
  "validators",
  {
    id: text("id").primaryKey(), // validator address (lowercased)
    moniker: text("moniker").notNull(),
    website: text("website").notNull().default(""),
    commissionBps: integer("commission_bps").notNull(),
    jailed: boolean("jailed").notNull().default(false),
    active: boolean("active").notNull().default(true),
    stakedAmount: numeric("staked_amount").notNull(),
    // Community registry enrichment (Class 3 — geo inference)
    region: text("region"),
    infraProvider: text("infra_provider"),
    flag: text("flag"),
    country: text("country"),
    slug: text("slug").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("validators_active_idx").on(t.active), index("validators_slug_idx").on(t.slug)]
);

// ── Validator profiles (claimed by operators via SIWE) ─────────────────────
export const validatorProfiles = pgTable("validator_profiles", {
  id: text("id").primaryKey(), // validator address
  displayName: text("display_name"),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  website: text("website"),
  twitterHandle: text("twitter_handle"),
  // SIWE claim state
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
  siweAddress: text("siwe_address"), // identity key that signed the claim
  siweExpiresAt: timestamp("siwe_expires_at"),
  // Operational notes and maintenance windows stored as JSONB
  notes: jsonb("notes").$type<OperatorNote[]>().default([]),
  maintenanceWindows: jsonb("maintenance_windows").$type<MaintenanceWindow[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type OperatorNote = {
  id: string;
  content: string;
  createdAt: string; // ISO 8601
};

export type MaintenanceWindow = {
  id: string;
  startTs: string; // ISO 8601
  endTs: string;
  reason: string;
  announced: boolean;
};

// ── Epoch snapshots ───────────────────────────────────────────────────────────
export const epochSnapshots = pgTable(
  "epoch_snapshots",
  {
    id: text("id").primaryKey(), // `${validatorId}:${epoch}`
    validatorId: text("validator_id")
      .notNull()
      .references(() => validators.id, { onDelete: "cascade" }),
    epoch: integer("epoch").notNull(),
    blocksProposed: integer("blocks_proposed").notNull().default(0),
    blocksMissed: integer("blocks_missed").notNull().default(0),
    successRate: real("success_rate").notNull(),
    votingPower: bigint("voting_power", { mode: "bigint" }).notNull(),
    delegatorCount: integer("delegator_count").notNull().default(0),
    scheduledDowntime: boolean("scheduled_downtime").notNull().default(false),
    snapshotAt: timestamp("snapshot_at").notNull(),
  },
  (t) => [
    uniqueIndex("epoch_snapshots_validator_epoch_idx").on(t.validatorId, t.epoch),
    index("epoch_snapshots_epoch_idx").on(t.epoch),
    index("epoch_snapshots_snapshot_at_idx").on(t.snapshotAt),
  ]
);

// ── Dispute tickets ───────────────────────────────────────────────────────────
export const disputeTickets = pgTable(
  "dispute_tickets",
  {
    id: text("id").primaryKey(),
    // Snapshot of the Iris response that triggered the report
    irisResponse: jsonb("iris_response").notNull(),
    toolCalls: jsonb("tool_calls").notNull().$type<ToolCallRecord[]>(),
    dataClassLabels: jsonb("data_class_labels").notNull().$type<Record<string, number>>(),
    // User-provided fields
    description: text("description").notNull(),
    expectedBehavior: text("expected_behavior"),
    category: text("category").notNull(), // wrong_number | wrong_validator | outdated | misleading | other
    reporterAddress: text("reporter_address"), // optional, for fast-track if validator
    // Triage
    status: text("status").notNull().default("automated_triage"), // automated_triage | resolved_self | escalate_human | duplicate
    triageResult: jsonb("triage_result").$type<TriageResult | null>().default(null),
    adminResponse: text("admin_response"),
    adminRespondedAt: timestamp("admin_responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("dispute_tickets_status_idx").on(t.status),
    index("dispute_tickets_created_at_idx").on(t.createdAt),
  ]
);

export type ToolCallRecord = {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
  dataClass: 1 | 2 | 3;
};

export type TriageResult = {
  ran_at: string;
  diff: Record<string, unknown>;
  formula_changed: boolean;
  indexer_lag_ms: number;
  auto_resolution: string | null;
};

// ── Validator metadata (community registry enrichment) ────────────────────
export const validatorMetadata = pgTable("validator_metadata", {
  pubkey: text("pubkey").primaryKey(), // validator address (lowercased), matches validators.id
  moniker: text("moniker"),
  logoUrl: text("logo_url"),
  website: text("website"),
  description: text("description"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Telemetry (operator node metrics, opt-in) ─────────────────────────────
export const telemetryNodes = pgTable(
  "telemetry_nodes",
  {
    id: text("id").primaryKey(), // HMAC-derived node ID, generated on install
    validatorId: text("validator_id").references(() => validators.id),
    publicKey: text("public_key").notNull(), // Ed25519 pub key for HMAC verification
    installedAt: timestamp("installed_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("telemetry_nodes_validator_idx").on(t.validatorId)]
);

export const telemetryMetrics = pgTable(
  "telemetry_metrics",
  {
    id: text("id").primaryKey(),
    nodeId: text("node_id")
      .notNull()
      .references(() => telemetryNodes.id, { onDelete: "cascade" }),
    ts: timestamp("ts").notNull(),
    cpuPercent: real("cpu_percent"),
    memPercent: real("mem_percent"),
    diskPercent: real("disk_percent"),
    blockHeight: bigint("block_height", { mode: "bigint" }),
    consensusLagMs: integer("consensus_lag_ms"),
    executionLagMs: integer("execution_lag_ms"),
    peerCount: integer("peer_count"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("telemetry_metrics_node_ts_idx").on(t.nodeId, t.ts),
    index("telemetry_metrics_ts_idx").on(t.ts),
  ]
);
