// On-chain validator data (Class 1 — deterministic, read from staking precompile)
export type OnChainValidator = {
  address: string;
  moniker: string;
  website: string;
  commissionBps: number;
  jailed: boolean;
  active: boolean;
  stakedAmount: bigint;
  flag?: string;
  country?: string;
  provider?: string;
};

export type NetworkStats = {
  totalValidators: number;
  activeValidators: number;
  successRate: number;
  diversityScore: number;
};

// Watchtower validator data (Class 1 — fetched from monad-watchtower.xyz)
export type WatchtowerValidator = {
  node_id: string;
  name: string;
  logo: string;
  blocks_proposed: number;
  blocks_skipped: number;
  total_blocks: number;
  uptime_percentage: number;
  last_seen: string;
  current_epoch_success_rate: number;
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
  tracking_window_hours: number;
  global_stats: {
    network_uptime: number;
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
