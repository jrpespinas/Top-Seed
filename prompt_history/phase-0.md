# Phase 0 — Top Seed monorepo scaffold

Implement **Phase 0 only**: pnpm monorepo, tooling, empty runnable apps, shared API contracts, and Fastify health check. Do **not** implement domain logic, Dexie, sync replay, dashboard features, or real Prisma models/migrations beyond a minimal scaffold.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

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

**Do not use:** NestJS, Express (unless Fastify plugin requires), TypeORM/Sequelize, GraphQL.

## Monorepo layout

```text
apps/
  web/                 # Vite + React organizer app
  api/                 # Fastify + Prisma client
packages/
  contracts/           # Zod schemas + inferred types (shared by web + api)
  domain/              # Placeholder — business logic lands in Phase 1
pnpm-workspace.yaml
package.json           # root scripts: dev, build, test, lint