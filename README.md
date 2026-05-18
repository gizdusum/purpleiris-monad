# PurpleIris v2

**Monad's open intelligence layer for staking decisions, validator operations, and network decentralization.**

Powered by **Iris** — a conversational AI grounded strictly in on-chain data, never in parametric knowledge. Every answer cites a source and carries a data-class label.

> "Iris — the open eye on Monad."

---

## Three doors

|     | Mode               | Route             | Status                  |
| --- | ------------------ | ----------------- | ----------------------- |
| 👤  | **Delegator Iris** | `/chat/delegator` | Phase 3                 |
| 🛠  | **Operator Iris**  | `/chat/operator`  | Phase 6                 |
| 🧪  | **Stake Sim**      | `/vault`          | Phase 10 — Testnet Beta |

The Stake Sim (Mode 3) is a public beta on Monad testnet only. Mainnet release pending professional audit.

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

The Mode 3 vault (`/vault`) is deployed **on Monad testnet only**. No mainnet deployment until a professional smart contract audit is complete. See the vault page for the full disclaimer.

## License

MIT
