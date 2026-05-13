import { defineChain } from "viem";

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});

export const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000001000" as const;

export const MONAD_RPC_URL = process.env.MONAD_RPC_URL ?? "https://rpc.monad.xyz";

export const EPOCH_LENGTH_BLOCKS = 50_000;
export const EPOCH_DURATION_MS = 5.5 * 60 * 60 * 1000;
