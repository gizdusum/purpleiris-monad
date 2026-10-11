import { createPublicClient, fallback, http } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "./config";

/**
 * Ordered, de-duplicated list of Monad mainnet RPC endpoints.
 *
 * The configured endpoint (MONAD_MAINNET_RPC_URL) is always tried first. The public
 * endpoints follow as fallbacks, so an expired provider key or a provider outage
 * degrades to slower public RPC instead of silently stopping every chain read.
 */
export function getRpcUrls(configured: string = MONAD_MAINNET_RPC_URL): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [configured, ...monadMainnet.rpcUrls.default.http]) {
    const url = raw?.trim();
    if (!url) continue;
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: monadMainnet,
      transport: fallback(
        getRpcUrls().map((url) =>
          http(url, {
            timeout: 10_000,
            retryCount: 1,
            retryDelay: 500,
          })
        ),
        // Start with the configured endpoint, then let viem re-rank by observed
        // stability and latency so a dead endpoint sinks instead of adding its
        // timeout to every call.
        {
          retryCount: 1,
          rank: {
            interval: 30_000,
            sampleCount: 5,
            timeout: 2_500,
            weights: { latency: 0.3, stability: 0.7 },
          },
        }
      ),
    });
  }
  return _client;
}
