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

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision Testnet", url: "https://testnet.monadvision.com" },
  },
});

export const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000001000" as const;

// Env var: MONAD_MAINNET_RPC_URL in production, falls back to public RPC for local dev
export const MONAD_MAINNET_RPC_URL =
  process.env["MONAD_MAINNET_RPC_URL"] ?? "https://rpc.monad.xyz";

export const MONAD_TESTNET_RPC_URL =
  process.env["MONAD_TESTNET_RPC_URL"] ?? "https://testnet-rpc.monad.xyz";

export const EPOCH_LENGTH_BLOCKS = 50_000;
export const EPOCH_DURATION_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours
