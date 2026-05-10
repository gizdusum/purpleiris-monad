const BASE = "https://monad-watchtower.xyz";

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
  alert_level: number; // 0=ok, 1=warning, 2=critical
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

export async function getWatchtowerOverview(): Promise<WatchtowerOverview> {
  const res = await fetch(`${BASE}/api/overview`, {
    next: { revalidate: 60 },
    headers: { "User-Agent": "PurpleIris/1.0" },
  });
  if (!res.ok) throw new Error(`Watchtower API ${res.status}`);
  return res.json() as Promise<WatchtowerOverview>;
}
