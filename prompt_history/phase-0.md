# Phase 0 — Top Seed monorepo scaffold

Implement **Phase 0 only**: pnpm monorepo, tooling, empty runnable apps, shared API contracts, and Fastify health check. Do **not** implement domain logic, Dexie, sync replay, dashboard features, or real Prisma models/migrations beyond a minimal scaffold.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

This phase establishes the **repo skeleton** so later phases can add domain rules (Phase 1), server persistence (Phase 2), and the local-first client kernel (Phase 3) without re-deciding tooling.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/architecture.md`
3. `docs/specs/backend/backend-stack.md` — **authoritative for backend tooling**
4. `docs/specs/backend/backend-architecture.md` — layers and folder shape (skim)
5. `docs/specs/backend/api-contracts.md` — `/api/v1`, envelopes, error shape, DTO naming
6. `docs/specs/frontend/frontend-stack.md`
7. `docs/specs/frontend/frontend-technical-standards.md` — tokens, units (skim)
8. `docs/specs/frontend/design-system.md` — semantic color intent (skim for token names)
9. `docs/specs/frontend/component-architecture.md` — route areas (skim)

Do **not** read all feature specs or primitive component specs in this phase.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package manager | **pnpm** workspaces |
| Language | **TypeScript** `strict: true` everywhere |
| API | **Fastify 5** + Node **20 LTS** |
| Database | **PostgreSQL 16** + **Prisma** (infra in `apps/api` only) |
| Frontend | **Vite** + **React 18** + TanStack Router + TanStack Query + Tailwind + Zod |
| Testing | **Vitest** (workspace-wide) |

**Do not use:** NestJS, Express (unless a Fastify plugin requires it), TypeORM/Sequelize, GraphQL.

## Monorepo layout

```text
apps/
  web/                 # Vite + React organizer app shell
  api/                 # Fastify + Prisma client (no real models yet)
packages/
  contracts/           # Zod schemas + inferred types (shared by web + api)
  domain/              # Placeholder — business logic lands in Phase 1
pnpm-workspace.yaml
package.json           # root scripts: dev, build, test, lint
tsconfig.base.json
eslint.config.js
docker-compose.yml     # PostgreSQL 16 for later phases
.env.example
README.md
.nvmrc                 # 20
```

## Suggested package layout

### `packages/contracts`

Shared Zod contracts per `api-contracts.md`. No Fastify or React imports.

```text
packages/contracts/src/
  envelopes.ts         # data/list/error envelopes + meta + pagination
  dtos.ts              # starter DTO schemas (health + named shapes for later phases)
  index.ts             # re-exports + healthResponseSchema helper
  contracts.test.ts    # envelope + DTO parse smoke tests
```

**Minimum exports:**

- `createDataEnvelopeSchema`, `createListEnvelopeSchema`, `errorEnvelopeSchema`
- `responseMetaSchema` with `serverTime` (ISO datetime)
- `healthDataSchema` → `{ status: "ok" }`
- `healthResponseSchema` (data envelope around health data)
- Starter DTO schemas aligned with naming in `api-contracts.md` (`sessionDtoSchema`, `checkInDtoSchema`, etc.) — **shape only**, no API routes yet

Do **not** add `sync.ts` or sync action payloads in this phase (Phase 2).

### `packages/domain`

Empty placeholder package so Phase 1 can drop in pure rules without reshaping the monorepo.

```text
packages/domain/src/
  index.ts             # empty export or comment stub
  README.md            # "business logic lands in Phase 1"
```

`package.json` should have `build`, `test`, and `lint` scripts (tests can be a trivial pass or empty suite).

### `apps/api`

Fastify app with health route only. Prisma wired but **no entity models**.

```text
apps/api/
  prisma/
    schema.prisma      # generator + datasource only (no models)
  src/
    http/
      errors.ts        # Zod → error envelope; basic 500 fallback
      plugins/
        health.ts      # GET /api/v1/health
        health.test.ts
    shared/
      http/
        meta.ts        # buildMeta() → { serverTime }
    app.ts             # Fastify + CORS + error handler + health routes
    server.ts          # listen on API_PORT (default 3001)
```

**Health response** (validate with `@top-seed/contracts` before send):

```json
{
  "data": { "status": "ok" },
  "meta": { "serverTime": "2026-06-09T12:00:00.000Z" }
}
```

**Error envelope** shape for future routes (handler can exist now; only health is registered):

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} },
  "meta": { "serverTime": "…" }
}
```

`postinstall` / `db:generate` runs `prisma generate` successfully against an empty schema.

Do **not** register session, sync, queue, or dashboard routes in this phase.

### `apps/web`

Runnable organizer shell — placeholder pages only.

```text
apps/web/src/
  main.tsx             # React 18 + TanStack Query + TanStack Router
  index.css            # Tailwind + CSS custom properties (design tokens)
  routes/
    router.tsx         # organizer route stubs
  components/
    ApiStatusBanner.tsx  # TanStack Query → GET /api/v1/health
  lib/
    api.ts             # fetchHealth() with Zod parse
  smoke.test.ts        # trivial contracts import test
```

**Routes** (per `component-architecture.md` — placeholders only):

| Path | Purpose |
|------|---------|
| `/` | redirect → `/organizer/sessions` |
| `/organizer/sessions` | session list placeholder + `ApiStatusBanner` |
| `/organizer/sessions/new` | create session placeholder |
| `/organizer/sessions/$sessionId/dashboard` | live dashboard placeholder |

**Design tokens** in `index.css` + `tailwind.config.js`: `background`, `foreground`, `muted`, `muted-foreground`, `border`, `primary`, `primary-foreground`, `success`, `warning`, `danger` — semantic names from `design-system.md`.

Vite dev server proxies `/api` → `VITE_API_URL` (default `http://localhost:3001`).

Do **not** add Dexie, outbox, sync engine, or dashboard feature components.

## Build — root tooling

| Deliverable | Notes |
|-------------|-------|
| `pnpm-workspace.yaml` | `apps/*`, `packages/*` |
| Root `package.json` | `dev`, `build`, `test`, `lint`; `predev`/`prebuild`/`pretest` build contracts |
| `tsconfig.base.json` | `strict: true`, `noUncheckedIndexedAccess: true` |
| `eslint.config.js` | Flat config, TypeScript recommended, ignore `dist/` |
| `.prettierrc` | Consistent formatting |
| `.nvmrc` | `20` |
| `.env.example` | `API_PORT`, `DATABASE_URL`, `VITE_API_URL` |
| `docker-compose.yml` | `postgres:16-alpine`, port 5432, db `topseed` |
| `README.md` | prerequisites, setup, scripts, health endpoint |

**Root `dev` script** runs web (5173) and API (3001) concurrently.

## Build — Prisma scaffold (minimal)

`apps/api/prisma/schema.prisma`:

- `generator client` + `datasource db` (PostgreSQL, `DATABASE_URL`)
- **No models** — comment that entities land in Phase 2
- Scripts: `db:generate` (and optional `db:push` no-op or documented for Phase 2)

Docker Compose is optional for Phase 0 tests but must be present for Phase 2 onboarding.

## Tests (required)

| Package | Examples |
|---------|----------|
| `packages/contracts` | Parse data/list/error envelopes; parse `healthDataSchema`; parse starter DTO fixtures |
| `apps/api` | `fastify.inject()` on `GET /api/v1/health` → 200 + valid `healthResponseSchema` |
| `apps/web` | Import `healthResponseSchema` or `fetchHealth` mock smoke test |
| `packages/domain` | Trivial pass or empty suite |

**Target:** at least **5–10** meaningful tests across the workspace. No database required for Phase 0 CI.

## Done when

- [ ] `pnpm install` succeeds at repo root
- [ ] `pnpm dev` starts web (5173) and API (3001) without errors
- [ ] `pnpm build` succeeds for all workspace packages
- [ ] `pnpm test` passes (contracts + health + smoke tests)
- [ ] `pnpm lint` runs across packages without config errors
- [ ] `GET /api/v1/health` returns `{ data: { status: "ok" }, meta: { serverTime } }`
- [ ] Web `/organizer/sessions` renders placeholder UI and `ApiStatusBanner` (healthy when API is up)
- [ ] `packages/contracts` exports envelopes + health schema used by both apps
- [ ] `packages/domain` exists as placeholder only (no business rules)
- [ ] Prisma `generate` works; schema has no production models yet
- [ ] `.env.example`, `docker-compose.yml`, and `README.md` document local setup
- [ ] No Dexie, sync routes, dashboard pegboard, or domain logic implemented

## Manual smoke

1. `cp .env.example .env` → `pnpm install` → `pnpm dev`
2. Open `http://localhost:5173/organizer/sessions` — placeholder page + green API banner
3. `curl http://localhost:3001/api/v1/health` — JSON envelope with `"status": "ok"`
4. Stop API — banner shows unreachable (wording can mention future offline support)

## Explicitly out of scope

- `packages/domain` business rules (Phase 1)
- Prisma entity models, migrations, repositories, use cases (Phase 2)
- `POST /api/v1/sync/actions` and all mutation routes (Phase 2)
- Dexie, outbox, local-first mutation pipeline (Phase 3)
- Dashboard UI: `PlayerCheckInPanel`, `QueuePanel`, `CourtBoard`, etc. (Phase 6+)
- UI primitives library (Phase 4)
- Login, player self-service, PWA service worker
- CI/GitHub Actions (optional stretch)
- Storybook, Playwright, MSW

## Phase 1 handoff notes

Phase 1 should find:

- Stable monorepo layout and shared contracts package
- Health check proving Fastify + Zod envelope wiring end-to-end
- Web shell with organizer route areas and design tokens
- Empty `packages/domain` ready for pure rule modules + Vitest

## Constraints for the implementer

- Prefer boring, explicit code over clever abstractions.
- Keep `apps/api` and `apps/web` thin — no business logic in controllers or React components.
- DTO schemas in `packages/contracts` are the cross-layer naming source of truth.
- If implementation needs conflict with specs, update the relevant spec in the same change and explain why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `fastify.inject()` test for Zod validation error envelope shape
- Root `pnpm format` script with Prettier
- `engines` + `packageManager` fields in root `package.json`
- Minimal `apps/api` graceful shutdown on SIGTERM
