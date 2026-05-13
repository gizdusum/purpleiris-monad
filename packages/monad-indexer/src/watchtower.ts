import type { WatchtowerValidator, WatchtowerOverview } from "@purpleiris/shared-types";

const BASE = "https://monad-watchtower.xyz";

export async function getWatchtowerOverview(): Promise<WatchtowerOverview> {
  const res = await fetch(`${BASE}/api/overview`, {
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": "PurpleIris/2.0" },
  });
  if (!res.ok) throw new Error(`Watchtower API ${res.status}`);
  return res.json() as Promise<WatchtowerOverview>;
}

export type { WatchtowerValidator, WatchtowerOverview };
