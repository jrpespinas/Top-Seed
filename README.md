# Top Seed

Organizer-centric, local-first badminton open-play queueing (MVP v1).

## Monorepo layout

```text
apps/
  api/          Fastify 5 + Prisma (PostgreSQL)
  web/          Vite + React 18 organizer shell
packages/
  contracts/    Shared Zod schemas and DTO types
  domain/       Pure business rules (Phase 1+)
```

Canonical product and architecture specs live in `docs/specs/` and `AGENTS.md`.

## Prerequisites

- Node.js 20 LTS
- pnpm 9+
- Docker (optional, for local PostgreSQL)

## Setup

```bash
pnpm install
cp .env.example .env
```

Optional PostgreSQL:

```bash
docker compose up -d
pnpm db:generate
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run web (5173) and API (3001) together |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run Vitest across the workspace |
| `pnpm lint` | ESLint across packages |
| `pnpm db:generate` | Generate Prisma client in `apps/api` |

## API

- Health: `GET /api/v1/health` → `{ data: { status: "ok" }, meta: { serverTime } }`

## Phase 0 scope

This scaffold includes tooling, shared contracts, empty runnable apps, and a health check only. Domain logic, Dexie, sync replay, dashboard UI, and real Prisma models arrive in later phases.
