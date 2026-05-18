# PurpleIris v1.0 — Iris

**Monad's open intelligence layer for staking decisions, validator operations, and network decentralization.**

Powered by **Iris** — a conversational AI grounded strictly in on-chain data, never in parametric knowledge. Every answer cites a source and carries a data-class label.

> "Iris — the open eye on Monad."

---

## Three doors

|     | Mode               | Route             | Status                  |
| --- | ------------------ | ----------------- | ----------------------- |
| 👤  | **Delegator Iris** | `/chat/delegator` | Live — v1.0             |
| 🛠  | **Operator Iris**  | `/chat/operator`  | Live — v1.0 (read-only) |
| 🧪  | **Stake Sim**      | `/vault`          | Planned — v2.0 Pythia   |

> Stake Sim ships in v2.0 "Pythia" with audited vault contracts.
> Until then the route is reserved and the landing surfaces a
> "Coming soon" state.

---

## Release roadmap

PurpleIris ships in mythologically themed releases. Each name maps
to what the release adds.

| Version  | Codename  | Theme                     | Scope                                                                                                                                          |
| -------- | --------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.0** | Iris      | Bridge between worlds     | Delegator chat (non-advisory, cited). Operator chat read-only over public on-chain data. Stake Sim placeholder.                                |
| v1.1     | Hermes    | Messenger, guide          | Operator authentication via SIWE. Validator-scoped operator persona unlocks peer-percentile comparisons.                                       |
| v1.2     | Argus     | The all-seeing watcher    | Telemetry agent (Go) + HMAC ingest. Operator chat gains live device metrics: CPU, RAM, disk I/O, IOWait, peer count, bandwidth.                |
| v1.3     | Mnemosyne | Memory, the muses' mother | Monad docs RAG. Operator troubleshooting with cited solutions. Anomaly detection on telemetry baselines. Push alerts via Telegram and Discord. |
| v2.0     | Pythia    | The oracle                | Stake Sim live. Audited vault contracts. Daemon rebalancer. Reward forecasting with explicit confidence intervals.                             |

Versions are additive. Each release preserves prior surfaces and
extends them.

---

## Monorepo layout

```
apps/
  web/                Next.js 14 frontend → Vercel
  daemon/             Vault rebalancer → Hostinger VPS
packages/
  shared-types/       Cross-package TypeScript types
  monad-indexer/      On-chain reads (viem, staking precompile)
  iris-agent/         Anthropic SDK agent + tool surface
  telemetry-ingest/   HMAC-verifying ingestion endpoint
  ui/                 shadcn/ui primitives
contracts/            Foundry vault (testnet only)
telemetry-agent/      Go binary for validator operators
deploy/               Docker Compose, systemd, nginx, GitHub Actions
legacy/               Salvaged v1 source — read-only reference
docs/                 Iris persona, methodology, operator guide
```

## Tech stack

| Layer           | Technology                                                             |
| --------------- | ---------------------------------------------------------------------- |
| Frontend        | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| LLM             | Anthropic SDK — Claude Sonnet 4.6 (Iris), Haiku 4.5 (cheap subtasks)   |
| Database        | Neon Postgres + Drizzle ORM                                            |
| Cache           | Upstash Redis                                                          |
| On-chain        | viem → Monad staking precompile (0x…1000)                              |
| VPS workloads   | Docker Compose + systemd + nginx + Let's Encrypt                       |
| Contracts       | Foundry, Solidity 0.8.x, ERC-4626                                      |
| Telemetry agent | Go 1.22+ static binary                                                 |

## Development

```bash
corepack enable
pnpm install
cp .env.example apps/web/.env.local
# fill in .env.local values
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
pnpm type-check
pnpm lint
```

## Deployment topology

| Service                | Host          | Subdomain                                |
| ---------------------- | ------------- | ---------------------------------------- |
| `apps/web`             | Vercel        | `purpleiris.live`, `www.purpleiris.live` |
| `monad-indexer` worker | Hostinger VPS | — (internal)                             |
| `telemetry-ingest`     | Hostinger VPS | `ingest.purpleiris.live`                 |
| `apps/daemon`          | Hostinger VPS | `daemon-admin.purpleiris.live`           |

## Data accuracy

Iris labels every factual claim with its class:

- **Class 1 — On-chain** (deterministic, staking precompile)
- **Class 2 — Derived** (formula-dependent; all formulas published at `/methodology` with version pinning)
- **Class 3 — Estimated** (uncertainty-aware; always reported as a range with confidence interval)

## Vault disclaimer

The Mode 3 vault (`/vault`) is reserved for the v2.0 "Pythia"
release. No deployment — testnet or mainnet — until a professional
smart contract audit is complete. See `/vault` for the current
placeholder state.

## License

MIT
