# @top-seed/api

Fastify API server with Prisma + PostgreSQL.

## Setup

```bash
# From repo root
docker compose up -d
cp .env.example .env

pnpm install
pnpm --filter @top-seed/api db:push   # or db:migrate for migration history
pnpm --filter @top-seed/api db:seed
```

## Development

```bash
pnpm --filter @top-seed/api dev
```

## Tests

Integration tests require PostgreSQL. Set `DATABASE_URL` in `.env` and run:

```bash
RUN_DB_TESTS=1 pnpm --filter @top-seed/api test
```

Without `RUN_DB_TESTS=1`, integration tests are skipped; validation and health tests still run.

## Key endpoints

- `GET /api/v1/health`
- `POST /api/v1/sync/actions`
- `POST /api/v1/sessions/:sessionId/check-ins`
- `GET /api/v1/sessions/:sessionId/dashboard`

Use cases in `src/modules/` are shared by REST routes and sync replay.
