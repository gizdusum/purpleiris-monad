import { createPublicClient, http } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "./config";

let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: monadMainnet,
      transport: http(MONAD_MAINNET_RPC_URL, {
        timeout: 10_000,
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
  }
  return _client;
}
