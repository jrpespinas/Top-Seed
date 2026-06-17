# Phase 2 — Backend persistence + use cases + sync replay

Implement **Phase 2 only**: PostgreSQL schema, Prisma repositories, application use cases, REST `/api/v1` mutations, and `POST /api/v1/sync/actions` replay — all sharing the same use-case layer. Do **not** implement Dexie, web offline kernel, dashboard UI, or UI primitives.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites:**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, `packages/contracts` envelopes, Fastify health, Docker Postgres |
| **1** | `packages/domain` pure rules + tests (queue, transitions, ratings, stats, payments) |

This phase makes the **server truth layer** real: the same organizer mutations work via direct HTTP **and** offline sync replay. Phase 3 (Dexie/outbox) depends on at least `CHECK_IN_PLAYER` + sync working here.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/backend/backend-stack.md` — **authoritative** for Fastify + Prisma tooling
3. `docs/specs/backend/backend-architecture.md` — layers, module layout, sync architecture
4. `docs/specs/backend/domain-model.md` — Prisma entity fields and relationships
5. `docs/specs/backend/state-transitions.md` — side effects use cases must enforce
6. `docs/specs/backend/sync-actions.md` — action catalog, ordering, idempotency
7. `docs/specs/backend/sync-payload-reference.md` — **golden JSON** for contract/integration tests
8. `docs/specs/backend/api-spec.md` — endpoint list and behaviors
9. `docs/specs/backend/api-contracts.md` — envelopes, error code registry, dashboard snapshot shape

Do **not** read frontend feature specs or Dexie guidance in this phase.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| API | **Fastify 5** in `apps/api` |
| ORM | **Prisma** + PostgreSQL 16 (`docker compose`) |
| Domain rules | **`@top-seed/domain`** — call from use cases; do not duplicate |
| DTOs / validation | **`@top-seed/contracts`** — extend with sync + API Zod schemas |
| Testing | Vitest + `fastify.inject()`; DB tests with test database or transactional setup |
| Auth | **None** in MVP — no login middleware |

**Forbidden in `packages/domain`:** `@prisma/client`, Fastify.  
**Forbidden in use cases:** returning raw Prisma models to HTTP layer.

## Suggested `apps/api` layout

Align with `backend-architecture.md` (adjust names only if clearer):

```text
apps/api/
  prisma/
    schema.prisma
    migrations/
  src/
    modules/
      organizations/     # default org seed
      players/
      sessions/
      courts/
      check-ins/
      queue/
      matches/
      payments/
      sync/
    shared/
      application/       # shared ports, errors, clock
      infrastructure/
        prisma/
          client.ts
          repositories/
          idempotency.ts
      http/
        plugins/
        errors.ts
        presenters/      # map domain → DTO envelopes
    app.ts
    server.ts
```

Within each module: `application/` use cases, `infrastructure/` repository impls, `http/` Fastify plugin.

## Build — Prisma schema + migrations

Model core entities from `domain-model.md`:

- `Organization` (single default org for MVP)
- `PlayerProfile`
- `Session`
- `Court`
- `CheckIn`
- `QueueLane`
- `QueuedMatch` + participants
- `Match` + participants
- `SyncActionLog` (or equivalent) for idempotency: `actionId`, `deviceId`, `organizationId`, `status`, `appliedAt`

Rules:

- Accept **client-generated string IDs** for offline-created rows.
- `requirePaymentBeforePlay` defaults `false`; do not build play gating.
- No `syncStatus` columns on every entity (client-only metadata per domain-model).
- Run `prisma migrate dev` with a meaningful initial migration.
- Seed script or migration seed: default `organizationId`, optional sample players.

## Build — repository ports + adapters

Repository interfaces live in `application/` ports; Prisma implementations in `infrastructure/`.

Minimum repositories:

- Sessions, Courts, CheckIns, QueueLanes, QueuedMatches, Matches, PlayerProfiles
- Idempotency / sync action log

Map Prisma ↔ plain types before calling `@top-seed/domain`. Use `prisma.$transaction` inside use cases for multi-entity workflows.

## Build — application use cases

Each use case: load → `@top-seed/domain` validation → persist → return result DTO.

**Session lifecycle**

| Use case | Direct API | Sync action |
|----------|------------|-------------|
| `CreateSession` | `POST /sessions` | `CREATE_SESSION` |
| `OpenSession` | `POST .../open` | `OPEN_SESSION` |
| `StartSession` | `POST .../start` | `START_SESSION` |
| `CheckInPlayer` | `POST .../check-ins` | `CHECK_IN_PLAYER` |
| `UpdateCheckIn` | `PATCH .../check-ins/:id` | `UPDATE_CHECK_IN` |

**Queue + matches (golden chain)**

| Use case | Direct API | Sync action |
|----------|------------|-------------|
| `CreateQueueLane` | `POST .../queue/lanes` | `CREATE_QUEUE_LANE` |
| `CreateQueuedMatch` | `POST .../lanes/:id/queued-matches` | `CREATE_QUEUED_MATCH` |
| `PromoteQueuedMatchToCourt` | `POST .../move-to-court` | `MOVE_QUEUED_MATCH_TO_COURT` |
| `StartMatch` | `POST .../matches/:id/start` | `START_MATCH` |
| `CompleteMatch` | `POST .../matches/:id/complete` | `COMPLETE_MATCH` |

**Also implement (smaller scope OK as thin wrappers)**

| Use case | Notes |
|----------|-------|
| `UpdatePayment` | `PATCH .../payment` + `UPDATE_PAYMENT` sync |
| `ProcessSyncActions` | Dispatches batch to same use cases |
| `GetSessionDashboard` | `GET .../dashboard` aggregate read |

**Domain integration examples**

- `validatePromoteQueuedMatch`, `clearPlayerFromOtherQueuedMatches` on promote
- `resolvePostMatchQueueStatus` on complete
- `computeMatchRatingDeltas` / `recomputeSessionFromMatches` on complete + correction
- `computePaymentSummary` for payments read model
- `validateSessionComplete` before session complete endpoint

## Build — HTTP layer (Fastify)

- One plugin per module under `/api/v1`.
- Validate with Zod from `@top-seed/contracts`.
- Return `{ data, meta }` or error envelope per `api-contracts.md`.
- Map domain/use-case errors to registry codes (`COURT_ALREADY_OCCUPIED`, `QUEUED_MATCH_NOT_READY`, `PLAYER_IS_PLAYING`, etc.).
- Handlers stay thin: parse → use case → present.

**Required routes (minimum)**

- `GET /api/v1/health` (already exists — keep)
- `POST /api/v1/sync/actions`
- `GET /api/v1/sync/status` (can return stub counts if device state is client-owned in MVP)
- `POST /api/v1/sessions` + `POST .../start`
- `POST /api/v1/sessions/:sessionId/check-ins`
- `GET /api/v1/sessions/:sessionId/dashboard` (aggregate; empty sections OK early, shape must match contract)
- Routes mirroring golden-chain use cases above

Implement additional `api-spec.md` endpoints only when needed by tests or golden chain — do not boil the ocean.

## Build — sync replay (`ProcessSyncActions`)

Per `sync-actions.md`:

```text
POST /api/v1/sync/actions
  → validate batch envelope
  → for each action in order:
      → if idempotency key seen: return already_applied
      → dispatch to use case by action.type
      → on hard failure: stop dependent later actions; continue independent when safe
  → return per-action results (sync response shape, not `{ data, meta }`)
```

**High-risk actions** must match `sync-payload-reference.md` golden JSON:

- `CREATE_QUEUED_MATCH`
- `MOVE_QUEUED_MATCH_TO_COURT`
- `COMPLETE_MATCH`
- `UPDATE_MATCH_RESULT` (implement if correction use case is in scope; otherwise defer with comment)

Extend `packages/contracts` with:

- Sync request/response Zod schemas
- Per-action payload schemas (or shared `SyncParticipantInput`, `MatchResultInput`)

## Build — dashboard snapshot

`GET /api/v1/sessions/:sessionId/dashboard` returns aggregate per `api-contracts.md`:

- `session`, `courts`, `checkIns`, `queue` (`lanes`, `queuedMatches`, optional `suggestion`)
- `matches.active`, `matches.recent`
- `payments.summary`, `payments.exceptions`
- `leaderboardPreview` (can be `[]` in this phase)
- `sync` metadata (`lastSyncedAt`, `serverVersion`)

Use `@top-seed/domain` `buildSuggestion` when `session.queueMode === 'suggested'`.

## Tests (required)

| Suite | Coverage |
|-------|----------|
| **Contracts** | Parse golden JSON from `sync-payload-reference.md` |
| **Use cases** | `CheckInPlayer` duplicate rejection; promote when court occupied |
| **HTTP** | `fastify.inject` happy paths + error envelopes |
| **Integration** | **Golden chain** idempotent replay |

**Golden chain integration test (required done criterion):**

Replay in one batch (or ordered sequence) from `sync-payload-reference.md`:

```text
CREATE_QUEUED_MATCH → MOVE_QUEUED_MATCH_TO_COURT → START_MATCH → COMPLETE_MATCH
```

Then replay the **same action IDs** again → `already_applied` / no duplicate side effects.

Add separate test: `CHECK_IN_PLAYER` via sync + via direct POST produce equivalent check-in row.

**Target:** at least **25–40** meaningful API tests (excluding Phase 1 domain tests).

Use test DB (`DATABASE_URL` pointing at `topseed_test` or docker) or document in-memory strategy. Do not require manual Postgres for `pnpm test` if you provide a scripted test DB setup in README.

## Done when

- [ ] `prisma migrate` applies cleanly; `pnpm db:generate` works
- [ ] `pnpm --filter @top-seed/api test` passes with golden chain + idempotency tests
- [ ] `pnpm test` at repo root still passes
- [ ] Direct `POST .../check-ins` and sync `CHECK_IN_PLAYER` share `CheckInPlayer` use case
- [ ] `POST /api/v1/sync/actions` dispatches at least: `CHECK_IN_PLAYER`, `CREATE_QUEUED_MATCH`, `MOVE_QUEUED_MATCH_TO_COURT`, `START_MATCH`, `COMPLETE_MATCH`
- [ ] Error responses use `api-contracts.md` codes (not generic 500 strings)
- [ ] `GET .../dashboard` returns valid `{ data, meta }` envelope
- [ ] No Dexie, `apps/web` mutation pipeline, or dashboard React features added
- [ ] `apps/api/README.md` or root README updated with migrate + test DB instructions

## Explicitly out of scope

- `apps/web` Dexie, outbox, offline banner (Phase 3)
- React dashboard, session pages, primitives (Phases 4–6)
- Login, JWT, roles, player self-service
- `requirePaymentBeforePlay`, payment gateway, export backup
- GraphQL, NestJS, TypeORM
- WebSockets, SSE
- Every sync action in catalog — implement golden chain + `CHECK_IN_PLAYER` + `UPDATE_PAYMENT` minimum; structure must allow adding more without refactor
- Full leaderboard recompute endpoints (preview `[]` OK)
- `POST .../queue/manual-assignment` legacy alias unless trivial

## Constraints for the implementer

- **One use case per mutation** — sync and REST both call it.
- Call `@top-seed/domain` for rules; fix domain if spec gap found, don't fork logic in API.
- Idempotency is non-negotiable for sync actions.
- Presenters map to contracts DTOs — never leak Prisma field names like internal FKs unless in DTO spec.
- Prefer boring transactions over clever event sourcing.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `UPDATE_MATCH_RESULT` correction use case + forward recompute using `recomputeSessionFromMatches`
- `POST /api/v1/sessions/:sessionId/queue/suggestions` calling `buildSuggestion`
- Testcontainers Postgres for CI-friendly integration tests
- `GET /api/v1/organizations/current` with seeded default org

## Handoff to Phase 3

When this phase is complete, Phase 3 should be able to:

1. Enqueue `CHECK_IN_PLAYER` offline with payloads validated by shared contracts.
2. `POST /api/v1/sync/actions` and receive per-action `applied` results.
3. Optionally refresh `GET .../dashboard` and merge without inventing server-only shapes.
