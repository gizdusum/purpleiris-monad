import { createPublicClient, http, fallback } from "viem";
import { monadMainnet, MONAD_RPC_URL } from "./config";

let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: monadMainnet,
      transport: fallback([
        http(MONAD_RPC_URL, { timeout: 10_000 }),
        http("https://rpc1.monad.xyz", { timeout: 10_000 }),
      ]),
    });
  }
  return _client;
}
