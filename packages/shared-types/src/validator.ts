// On-chain validator data (Class 1 — deterministic, read from staking precompile)
export type OnChainValidator = {
  address: string;
  secpPubkey?: string; // compressed secp256k1 pubkey, 66 hex chars, no 0x prefix
  moniker: string;
  website: string;
  commissionBps: number;
  jailed: boolean;
  active: boolean;
  stakedAmount: bigint;
  flag?: string;
  country?: string;
  provider?: string;
  validatorId?: bigint;
  unclaimedRewards?: bigint; // pending commission in wei (resets on claim)
};

export type NetworkStats = {
  totalValidators: number;
  activeValidators: number;
  successRate: number;
  diversityScore: number;
};

// Watchtower validator data (Class 1 — fetched from monad-watchtower.xyz)
export type WatchtowerValidator = {
  node_id: string; // 0x-prefixed secp256k1 pubkey
  name: string;
  logo: string;
  blocks_proposed: number;
  blocks_skipped: number;
  total_blocks: number;
  uptime_percentage: number;
  last_seen: string; // ISO-8601
  last_finalized_at: string; // ISO-8601
  last_block_round: number;
  current_epoch_finalized: number;
  current_epoch_skipped: number;
  current_epoch_success_rate: number; // 0–100
  current_epoch_last_round: number;
  is_down: boolean;
  active_now: boolean;
  alert_level: 0 | 1 | 2;
  consecutive_skipped: number;
  consecutive_proposed: number;
  epochs_observed: number;
  vdp_flagged_weeks: number;
  vdp_weeks_analyzed: number;
};

export type WatchtowerOverview = {
  last_updated: string;
  current_epoch: number;
  current_epoch_started_at: string; // ISO-8601
  tracking_window_hours: number;
  validator_count: number;
  global_stats: {
    network_uptime: number; // 0–100
    total_proposed: number;
    total_skipped: number;
    active_validators: number;
  };
  validators: WatchtowerValidator[];
};

// Merged view used by Iris tools
export type ValidatorView = OnChainValidator & {
  watchtower?: WatchtowerValidator;
  slug: string;
  claimed: boolean;
};
