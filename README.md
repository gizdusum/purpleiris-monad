# PurpleIris

**Validator intelligence for Monad, as an assistant and as an API. Every number carries a label saying where it came from.**

PurpleIris answers questions about Monad staking and validators. It reads the staking precompile and an on-chain indexer, and tags each value it returns as on-chain, derived, or estimated. It reports data and never tells you which validator to pick.

|              |                                        |
| ------------ | -------------------------------------- |
| Live product | <https://purpleiris.live>              |
| API and MCP  | <https://purpleiris.live/developers>   |
| MCP endpoint | `https://purpleiris.live/api/mcp`      |
| REST         | `https://purpleiris.live/api/v1/tools` |
| Status       | <https://purpleiris.live/status>       |
| Methodology  | <https://purpleiris.live/methodology>  |

## Metropolis hackathon submission

Track 04, Trust, Identity & AI Infrastructure.

This repository contains work from two periods. The hackathon rules ask for pre-existing components to be identified, so here they are.

### Pre-existing foundation (10 May – 23 June 2026)

Everything up to and including commit [`55f55db`](../../commit/55f55db) (145 commits):

- The chat assistant with Delegator and Operator modes (`apps/web`, `packages/iris-agent`).
- 14 agent tools over an indexed Postgres database, with the Class 1 / 2 / 3 labelling rules and the citation guard.
- The indexer worker, the staking-rewards and execution-revenue indexers, and the database schema (`packages/monad-indexer`).
- The methodology page, the landing page, and deployment files for the VPS.

No work was done on the project between 23 June and 11 October 2026.

### Built during the hackathon (from 11 October 2026)

Every commit after `55f55db`:

- **Public MCP server** at `/api/mcp`: a stateless Model Context Protocol server (Streamable HTTP, JSON responses) that exposes the tools to any MCP client. `packages/iris-agent/src/public-api/mcp.ts`
- **REST API** at `/api/v1/tools`, with input validation for untrusted callers and an OpenAPI 3.1 document generated from the tool catalog. `packages/iris-agent/src/public-api/`
- **Live on-chain snapshot**: a new tool, `get_onchain_snapshot`, that reads the validator set, stake and commission directly from the staking precompile with every read pinned to one block, and returns that block number. No database involved. `packages/monad-indexer/src/live-snapshot.ts`
- **Live validator and delegator read**: a second chain-backed tool, `get_validator_onchain`, reads one validator at one block: its decoded flags, stake and commission in the execution, consensus and snapshot views, what the operator can claim, and optionally one delegator's active stake, claimable rewards and stake waiting to activate. `packages/monad-indexer/src/live-validator.ts`
- **Validator flags decoded**: the precompile's `flags` bitfield is decoded (ok, stake too low, withdrawn, double sign) using the bit positions in the Monad client source. `packages/monad-indexer/src/validator-flags.ts`
- **A corrected label**: `getValidator().unclaimedRewards` was presented as the operator's pending commission. It is the pool owed to all of the validator's delegators; commission is credited to the auth address as a delegator. Tool output, prompts and the methodology page now say so, and the operator's real claimable balance comes from `getDelegator(id, authAddress)`.
- **Freshness labelling**: every database-backed tool result now says when the index was last refreshed and whether it is stale, and the assistant is instructed to state that date instead of calling stale data current.
- **RPC fallback**: chain reads fall back to public Monad RPC endpoints when the configured provider fails. Before this, an expired provider key silently froze the index.
- **Self-healing validator sync**: the web deployment can refresh the validator table from the precompile on a schedule when the indexer worker is down. `packages/monad-indexer/src/sync.ts`
- **Honest status page**: the status page previously showed generated log lines and fixed numbers. It now shows only measured values and reports degraded sources as degraded.
- **Developer page** at `/developers` with a console that runs real API calls.
- 69 unit tests for the above, a CI workflow that runs them, and this README.

### Repository history

The project was developed in a private repository and published here on 11 October 2026. Before publishing, build artefacts (`node_modules` links, `.turbo` logs) and the old CI workflow file, which targeted a private self-hosted runner, were removed from history, and commit author metadata was normalised to the maintainer's handle. Commit dates, messages and all other source content are unchanged.

### AI tooling disclosure

AI coding assistants were used extensively in both periods. The hackathon additions were written with Claude (Anthropic) under the maintainer's direction, and those commits carry a `Co-Authored-By` trailer. The assistant inside the product calls the Anthropic API at runtime.

## Monad integration

PurpleIris deploys no contracts and sends no transactions. It reads Monad mainnet (chain id 143).

| What                 | Where                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Staking precompile   | `0x0000000000000000000000000000000000001000`                                   |
| Calls made           | `getEpoch()`, `getExecutionValidatorSet(uint32)`, `getValidator(uint64)`, `getDelegator(uint64,address)` |
| Events indexed       | proposer-reward events, topic `0x3a420a01…` (staking rewards indexer)          |
| Block data indexed   | per-block priority fees attributed to the proposer (execution revenue indexer) |
| Default RPC fallback | `https://rpc.monad.xyz`, `https://rpc1.monad.xyz`                              |

You can reproduce a live snapshot value yourself. The API returns `as_of_block`; replay the same call at that block:

```bash
# what PurpleIris reports
curl -s https://purpleiris.live/api/v1/tools/get_onchain_snapshot | jq '.data | {as_of_block, epoch, validator_set_size}'

# the same read against any Monad RPC (Foundry)
cast call 0x0000000000000000000000000000000000001000 "getEpoch()(uint64,bool)" \
  --rpc-url https://rpc.monad.xyz --block <as_of_block>
```

Why Monad: validator-set questions are only worth answering if the answer is current. Monad's 400 ms blocks and enshrined staking precompile make it practical to read the whole validator set at a single block, on demand, from a serverless function, and to cite that block in the answer.

## Data classes

| Class | Meaning   | Example                                                 |
| ----- | --------- | ------------------------------------------------------- |
| 1     | On-chain  | Stake, commission, epoch, pending commission            |
| 2     | Derived   | Nakamoto coefficient, Shannon entropy, success rate     |
| 3     | Estimated | Projected APY, reward simulations, self-reported region |

Class 3 values come with a range and a stated weakness. Definitions and formulas are on the [methodology page](https://purpleiris.live/methodology) and in `docs/methodology.md`.

## Using the API

```bash
# MCP: add to Claude Code
claude mcp add --transport http purpleiris https://purpleiris.live/api/mcp

# MCP: raw JSON-RPC
curl -s https://purpleiris.live/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# REST
curl -s https://purpleiris.live/api/v1/tools
curl -s 'https://purpleiris.live/api/v1/tools/estimate_stake_reward?stake_mon=10000&days=90'
curl -s https://purpleiris.live/api/v1/tools/get_validator \
  -H 'content-type: application/json' -d '{"id":"backpack"}'
```

Every tool returns the same envelope:

```json
{
  "tool": "get_network_health",
  "data": { "...": "..." },
  "data_class": 1,
  "data_class_label": "Class 1 — on-chain (deterministic)",
  "source": "get_network_health",
  "timestamp": "2026-10-11T13:20:00.000Z",
  "freshness": { "indexed_at": "2026-10-11T12:05:00.000Z", "age_hours": 1.3, "stale": false }
}
```

The API is read-only and needs no key. It is limited to 60 requests per minute per IP.

### Tools

| Tool                       | Source  | Returns                                                                             |
| -------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `get_onchain_snapshot`     | chain   | Block, epoch, validator set size, total stake, Nakamoto coefficient, top validators |
| `get_validator_onchain`    | chain   | One validator live: flags, stake and commission views, claimable rewards, a delegator's position |
| `get_validator`            | index   | One validator's profile, block metrics and health score                             |
| `list_validators`          | index   | Validators filtered by commission, stake, region, provider                          |
| `get_network_health`       | index   | Active validators, total stake, Nakamoto coefficient                                |
| `find_underdogs`           | index   | High success rate, low stake rank                                                   |
| `simulate_delegation`      | index   | Class 3 reward range for a stake with one validator                                 |
| `simulate_diversification` | index   | Class 2 entropy score for a stake split                                             |
| `estimate_stake_reward`    | formula | Class 3 reward range from amount, days and commission                               |
| `get_recent_assignments`   | index   | Per-epoch blocks proposed and missed                                                |
| `get_network_overview`     | index   | Epoch, 30-day aggregates, alert distribution                                        |
| `get_latest_monad_release` | index   | Latest Monad release tag and date                                                   |
| `get_assignment_predictor` | index   | Expected versus actual round assignments                                            |
| `get_anomaly_check`        | index   | Timeout clusters, rate drops, offline periods                                       |
| `get_execution_revenue`    | index   | 7-day and 24-hour priority fee income                                               |
| `get_staking_rewards`      | index   | Pending and historical staking commission                                           |

## Architecture

```
                     Monad mainnet (chain id 143)
                 staking precompile 0x…1000 · blocks
                        │                    │
          live, pinned to one block     indexed on a schedule
                        │                    │
        packages/monad-indexer        packages/monad-indexer
          live-snapshot.ts              worker.ts, *-indexer.ts
                        │                    │
                        │               Postgres (Neon)
                        │                    │
                        └─────────┬──────────┘
                                  │
                       packages/iris-agent
                     16 tools, one definition each
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
   in-app assistant           MCP server              REST API
  /chat/delegator            /api/mcp              /api/v1/tools
  /chat/operator
```

```
apps/
  web/                Next.js 14 app: pages, chat routes, MCP and REST routes (Vercel)
  daemon/             Placeholder for a future worker
packages/
  iris-agent/         Agent loop, tools, prompts, citation guard, public API layer
  monad-indexer/      Chain reads (viem), live snapshot, indexers, Drizzle schema
  shared-types/       Cross-package TypeScript types
  telemetry-ingest/   HMAC-verifying ingestion endpoint
  ui/                 Shared UI primitives
deploy/               Docker Compose, systemd units, nginx configs for the indexer VPS
docs/                 Persona and methodology
legacy/               Earlier prototype, kept for reference, not imported
```

Stack: TypeScript, Next.js 14 (App Router), viem, Drizzle ORM on Neon Postgres, Anthropic SDK, Upstash rate limiting, Vitest, pnpm workspaces with Turborepo.

## Running it locally

Requires Node 22 and pnpm 9.

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in the values you need, see below
pnpm --filter @purpleiris/web dev     # http://localhost:3000
```

| Variable                                             | Needed for                                   |
| ---------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                                       | Index-backed tools and the chat assistant    |
| `ANTHROPIC_API_KEY`                                  | The chat assistant                           |
| `MONAD_MAINNET_RPC_URL`                              | Optional. Falls back to public Monad RPC     |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional. Falls back to an in-memory limiter |

With no environment at all, `get_onchain_snapshot` and `estimate_stake_reward` still work through `/api/mcp` and `/api/v1/tools`, because they need only a Monad RPC.

To populate the database, run the migrations and the indexer:

```bash
cd packages/monad-indexer
pnpm tsx scripts/run-migrations.ts
pnpm indexer
```

### Checks

```bash
pnpm -r run type-check
pnpm --filter @purpleiris/iris-agent run test   # 69 tests, no network needed
pnpm --filter @purpleiris/web run build
```

The 30-prompt accuracy suite in `packages/iris-agent/tests/iris-accuracy.spec.ts` calls the Anthropic API and skips itself when `ANTHROPIC_API_KEY` is not set.

## Known limitations

- Block-production metrics (success rate, missed blocks) come from a third-party feed, [monad-watchtower.xyz](https://monad-watchtower.xyz). When it is unreachable those fields are null and the status page says so.
- Index-backed tools are only as fresh as the last indexer run. Each result states its age; `get_onchain_snapshot` is the tool for current totals.
- Monad has no "jailed" state. The indexed `jailed` column now mirrors the double-sign flag; the full flag set is only in the live tools. The indexer worker picks this up when it is next rebuilt.
- `get_validator_onchain` finds a validator by name or address through the live validator set, so a validator outside the current set must be read by numeric id.
- A live snapshot reads every validator and takes 10 to 15 seconds when it is not cached.
- Class 3 reward estimates use a fixed baseline rate. They are labelled as estimates and should be read as ranges.
- Validator names, regions and infrastructure providers are self-reported in the community registry and are not verified.

## Attribution

- Validator names and metadata: [monad-developers/validator-info](https://github.com/monad-developers/validator-info).
- Block-production metrics: [monad-watchtower.xyz](https://monad-watchtower.xyz).
- Libraries: [Next.js](https://nextjs.org), [viem](https://viem.sh), [Drizzle ORM](https://orm.drizzle.team), [@neondatabase/serverless](https://github.com/neondatabase/serverless), [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript), [@upstash/ratelimit](https://github.com/upstash/ratelimit-js), [zod](https://zod.dev), [Tailwind CSS](https://tailwindcss.com), [Framer Motion](https://www.framer.com/motion/), [react-markdown](https://github.com/remarkjs/react-markdown), [Vitest](https://vitest.dev). Full list in each `package.json`.
- The MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io) specification directly and has no SDK dependency.

## Disclaimer

PurpleIris surfaces data and analysis. Nothing it returns is financial advice.

## License

[MIT](LICENSE)
