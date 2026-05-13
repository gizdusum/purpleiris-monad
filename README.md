# Purple Iris

Validator intelligence platform for the Monad network. Scores validators like FIFA cards — OVR rating, reliability streaks, commission trust, and geographic diversity analysis.

## Features

- **Validator Discovery** — Browse all active Monad validators with live performance data
- **OVR Score** — FIFA-style composite score: reliability streak, commission trust (VDP), voting power
- **Network Weather** — 5-state health metaphor (Sunny → Stormy) based on network-wide success rate
- **Head-to-Head Compare** — Side-by-side validator comparison across all metrics
- **Delegator Diversity Score** — Analyze your stake spread across regions and operators
- **Validator Profiles** — Per-validator pages with historical epoch snapshots
- **Find Wizard** — Interactive delegator wizard to match validators to user priorities
- **Bilingual** — English and Turkish, switchable from the header

## Stack

- Next.js 16 + React 19 (App Router)
- Prisma + PostgreSQL — validator and epoch data
- Redis — caching layer
- next-intl — i18n (EN/TR)
- Framer Motion + shadcn/ui — UI
- viem — Monad RPC integration
- Nginx + Certbot — reverse proxy and TLS

## Routes

| Path          | Description                                    |
| ------------- | ---------------------------------------------- |
| `/`           | Homepage — hero, network weather, score teaser |
| `/validators` | Full validator list with live data             |
| `/v/[slug]`   | Individual validator profile                   |
| `/find`       | Delegator wizard                               |
| `/compare`    | Head-to-head comparison                        |
| `/me`         | Personal stake diversity score                 |
| `/operator`   | Operator panel                                 |
| `/insights`   | Network insights                               |
| `/learn`      | Educational content                            |

## Self-hosting

### Prerequisites

- Docker + Docker Compose
- Nginx with SSL (Certbot)
- Domain pointing to your server

### Setup

```bash
git clone https://github.com/gizdusum/purpleiris.git
cd purpleiris
cp .env.example .env
# fill in .env values
docker compose -f docker/docker-compose.prod.yml up -d --build
```

### Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `NEXT_PUBLIC_APP_URL` — public URL (e.g. `https://purpleiris.live`)
- `MONAD_RPC_URL` — Monad RPC endpoint
- `OPENROUTER_API_KEY` — OpenRouter key for AI wizard features

### Nginx config

The web container binds to `127.0.0.1:3005`. Point your nginx proxy_pass to `http://localhost:3005`.

## Development

```bash
npm install
cp .env.example .env
# fill in .env values
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

MIT
