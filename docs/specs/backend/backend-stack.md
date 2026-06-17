# Backend Stack Spec

## Purpose

This spec defines the chosen backend and monorepo tooling for Top Seed. Use it before adding dependencies, scaffolding `apps/api`, or hiring backend engineers.

Architecture rules (layers, use cases, sync replay) remain in `docs/specs/backend/backend-architecture.md`. API shapes remain in `docs/specs/backend/api-contracts.md`.

## Chosen Stack

### Monorepo

- **Package manager:** `pnpm` workspaces
- **Language:** TypeScript (strict) across web, API, contracts, and domain packages

```text
apps/
  web/                 React organizer app (see frontend-stack.md)
  api/                 Fastify HTTP server + sync processor
packages/
  contracts/           Zod schemas + inferred types (API + sync envelopes)
  domain/              Pure business rules (no Fastify, no Prisma)
```

### API server (`apps/api`)

- **Runtime:** Node.js 20 LTS
- **HTTP framework:** Fastify 5.x
- **Validation at the edge:** Zod (prefer schemas from `packages/contracts`)
- **API style:** REST `/api/v1` + workflow endpoints per `api-spec.md`
- **Sync:** `POST /api/v1/sync/actions` dispatches to the same application use cases as direct mutations

### Database (`apps/api` infrastructure)

- **Database:** PostgreSQL 16+
- **ORM / migrations:** Prisma
- **Rules:**
  - Prisma schema and client live only in `apps/api` infrastructure (or `packages/db` if extracted later).
  - Domain and application layers must not import `@prisma/client`.
  - Repositories map Prisma models ↔ domain types at the infrastructure boundary.
  - Migrations are the source of truth for persistence shape; align with `domain-model.md`.

### Shared packages

| Package | Role |
|---------|------|
| `packages/contracts` | Zod DTOs, sync envelope shapes, shared with `apps/web` for parse/validate |
| `packages/domain` | Queue policy, rating math, payment rules, state-transition helpers — **zero I/O** |

### Testing

- **Runner:** Vitest (workspace-wide)
- **API:** `fastify.inject()` for route/integration tests
- **Domain:** unit tests only, no database
- **Contracts:** fixture JSON parsed against Zod

### Local development

- `docker compose` for PostgreSQL (optional in Phase 0, required from Phase 2)
- Environment via `.env` / `.env.example` (`DATABASE_URL`, `API_PORT`, `VITE_API_URL`)

## Why This Stack

- **Hireability:** TypeScript + Node + Postgres is one of the largest full-stack talent pools; Prisma is widely known.
- **Efficiency:** Fastify is lightweight and fast to scaffold; no heavy framework magic for MVP.
- **Monorepo:** `packages/contracts` shares sync/API shapes with the React app — fewer drift bugs offline.
- **Clean Architecture fit:** Fastify routes stay thin; Prisma stays in repositories; domain stays framework-free in `packages/domain`.
- **Sync replay:** One language makes `ProcessSyncActions` and use-case mapping easier to test end-to-end.

## Fastify Conventions

- One plugin per module (`sessions`, `queue`, `sync`, etc.) registering routes under `/api/v1`.
- Use Fastify's Zod type provider or manual `contracts` parse in route `preHandler` — do not skip validation.
- Map application errors to `api-contracts.md` error envelope (`code`, `message`, `details`).
- Do not return raw Prisma records from route handlers; map to DTOs.
- Keep route handlers under ~15 lines: validate → use case → present.

## Prisma Conventions

- Model names align with `domain-model.md` entities (`Session`, `CheckIn`, `QueueLane`, `QueuedMatch`, `Match`, etc.).
- Use transactions (`prisma.$transaction`) inside application use cases for multi-entity workflows.
- Store sync idempotency keys (action `id` + `deviceId` + `organizationId`) in a dedicated table or unique constraint.
- Accept client-generated string IDs for offline-created entities.
- Prefer explicit `select`/`include` in repositories over leaking full models upward.

## Libraries To Avoid By Default

- **NestJS** for MVP — adds ceremony; Fastify is the chosen HTTP layer unless the team explicitly revisits this spec.
- **TypeORM / Sequelize** — Prisma is the standard for this repo.
- **GraphQL** — REST + sync batch is the contract.
- **Microservice frameworks** — modular monolith only for MVP.
- **Raw SQL in application layer** — keep SQL in Prisma repositories or rare infrastructure queries.
- **Duplicating DTO types** outside `packages/contracts` without strong reason.

## Relationship To Frontend

| Concern | Location |
|---------|----------|
| Organizer UI | `apps/web` per `frontend-stack.md` |
| API types / Zod | `packages/contracts` imported by web + api |
| Business rules | `packages/domain` imported by api only |
| Local-first storage | Dexie in `apps/web` — not Prisma |

TanStack Query calls the API; Dexie remains the live-session write path. See `frontend-stack.md` local-first section.

## Testing Implications

Backend tests should cover:

- Domain queue determinism, payment transitions, rating math (`packages/domain`)
- Contract schema parsing (`packages/contracts`)
- Use case workflows with test doubles for repositories
- Sync replay idempotency and `blocked` dependency behavior
- Fastify routes return correct envelopes and error codes from the registry in `api-contracts.md`

## Review Checklist

Before adding a backend dependency:

- Does it stay out of `packages/domain`?
- Can sync replay and direct API share the same use case?
- Does it work with Prisma + Postgres without bypassing repository ports?
- Will a mid-level TypeScript hire recognize the pattern in six months?

## Implementation Phases

Stack adoption by phase:

| Phase | Backend deliverable |
|-------|---------------------|
| 0 | Fastify health + `packages/contracts` + empty `packages/domain` |
| 1 | Domain logic + tests in `packages/domain` |
| 2 | Prisma schema, repositories, use cases, sync processor |

See implementation planning in project README when scaffold exists.
