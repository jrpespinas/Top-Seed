# Phase 9 — API sync parity and outbox ordering

Implement **Phase 9 only**: close the **server replay gap** that causes walk-in check-ins and Phase 7 back-office mutations to fail sync (e.g. **“Player not found.”**); fix **outbox flush ordering** so org-level actions run before dependent session actions; align client action names with `sync-actions.md`. Do **not** implement player self-service routes, login, PWA, export/import backup, or full snapshot merge on connect.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0–1** | Monorepo, contracts, `packages/domain` |
| **2** | API use cases + sync replay for core queue/match chain |
| **3** | Dexie, outbox, `flushOutbox`, `applyMutation` |
| **4–6** | UI kit, sessions, live dashboard |
| **7** | Payments, history, leaderboard, players; local `UPDATE_*` mutations |
| **8** | `SyncReviewPanel`, blocked/failed/retry UX |

Phases 3–8 enqueue many sync action types locally. Phase 2 replay only handles:

`CHECK_IN_PLAYER`, `CREATE_QUEUED_MATCH`, `MOVE_QUEUED_MATCH_TO_COURT`, `START_MATCH`, `COMPLETE_MATCH`.

**Observed production bug (must fix):**

1. Organizer adds walk-in **“Bogs”** → `createPlayerLocal` + `checkInPlayerLocal` succeed in Dexie.
2. `flushOutbox(sessionId)` syncs `CHECK_IN_PLAYER` but **never flushes** the preceding `CREATE_PLAYER` row (`sessionId: ""`).
3. API `CheckInPlayer` looks up `playerProfileId` in PostgreSQL → **`Player not found.`**
4. Phase 8 marks later session actions **blocked** until the failure is resolved — retry alone cannot succeed.

Phase 9 makes **local-first organizer workflows actually reconcile with the server** for the actions organizers use every session.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/backend/sync-actions.md` — **authoritative** action catalog, ordering, idempotency, `CREATE_PLAYER_PROFILE`
3. `docs/specs/backend/sync-payload-reference.md` — golden JSON; add missing player/payment/correction examples if needed
4. `docs/specs/backend/api-contracts.md` — error codes (`PLAYER_NOT_FOUND`, sync result shapes)
5. `docs/specs/backend/backend-architecture.md` — one use case per mutation; sync + REST share use cases
6. `docs/specs/backend/api-spec.md` — optional `POST /api/v1/players` shares `CreatePlayerProfile`
7. `docs/specs/backend/payments.md` — `UPDATE_PAYMENT` rules
8. `docs/specs/backend/match-results-and-ratings.md` — `UPDATE_MATCH_RESULT` correction + recompute
9. `docs/specs/backend/state-transitions.md` — `UPDATE_CHECK_IN` queue status transitions
10. `docs/specs/frontend/frontend-technical-standards.md` — outbox ordering, preserve failed rows

Skim only: `features/organizer/sync-review-panel.md` (retry UX already shipped in Phase 8).

Do **not** read player-facing route specs.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| API | **Fastify 5** + Prisma — new use cases under `apps/api/src/modules/` |
| Contracts | **`@top-seed/contracts`** — canonical sync action type strings + payload Zod schemas |
| Domain | **`@top-seed/domain`** — payment totals, rating recompute, queue transitions |
| Web | Fix `flushOutbox` / `listPendingOutboxActions` in `apps/web/src/sync/`; rename misaligned action types |
| Testing | API: `fastify.inject` + DB golden chains; Web: `fake-indexeddb` walk-in flush integration test |
| Auth | **None** in MVP |

**Do not use:** parallel sync queues, auto-discard failed actions, login middleware, GraphQL.

## Problem summary (implementer must understand)

| Layer | Current gap | Phase 9 fix |
|-------|-------------|-------------|
| **Action name** | Web enqueues `CREATE_PLAYER`; spec says `CREATE_PLAYER_PROFILE` | Rename client type; accept both in API dispatcher during migration **or** one-shot rename + test migration |
| **Outbox flush** | `flushOutbox(sessionId)` only loads rows with matching `sessionId` | Include org-scoped pending rows (`sessionId` empty) **before** session rows, sorted by `createdAt` |
| **API replay** | No `CreatePlayerProfile` use case / dispatcher case | Implement + idempotent replay |
| **Check-in dependency** | Server assumes profile already exists | Document + test: `CREATE_PLAYER_PROFILE` before `CHECK_IN_PLAYER` for same `playerProfileId` |
| **Phase 7 actions** | `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE`, `UPDATE_CHECK_IN` fail with `SYNC_ACTION_UNKNOWN` | Implement use cases + dispatcher cases |

## Suggested layout

### `apps/api`

```text
apps/api/src/modules/
  players/
    create-player-profile.ts      # CreatePlayerProfile use case
    update-player-profile.ts      # UpdatePlayerProfile use case
  check-ins/
    update-check-in.ts            # UpdateCheckIn use case
  payments/
    update-payment.ts             # UpdatePayment use case
  matches/
    correct-match-result.ts       # UpdateMatchResult use case (reuse domain recompute)
  sync/
    process-sync-actions.ts       # extend dispatch switch
```

### `apps/web`

```text
apps/web/src/
  sync/
    outbox.ts                     # listPendingForFlush(sessionId?) — org + session ordering
    syncEngine.ts                 # flushOutbox uses new listing helper
  mutations/
    createPlayer.ts               # type: CREATE_PLAYER_PROFILE
  lib/
    sync-action-labels.ts         # label for CREATE_PLAYER_PROFILE
```

## Recommended build order (vertical slices)

1. **Contracts alignment** — `CREATE_PLAYER_PROFILE` as canonical type; payload schema matches `sync-actions.md`; update golden tests.
2. **API `CreatePlayerProfile`** — use case + `process-sync-actions` case + idempotency.
3. **Web outbox ordering** — org-level pending rows included in flush; walk-in integration test passes.
4. **Golden walk-in chain** — API test: `CREATE_PLAYER_PROFILE` → `CHECK_IN_PLAYER` → `CREATE_QUEUED_MATCH` (optional) idempotent replay.
5. **`UpdatePayment`** — use case + sync replay; no double-count on replay.
6. **`UpdateCheckIn`** — queue status / suggestion exclude fields per spec.
7. **`UpdatePlayerProfile`** — organizer profile edits from Phase 7 drawer.
8. **`UpdateMatchResult`** — correction + forward recompute via `@top-seed/domain`.
9. **Docs matrix** — supported replay table in `apps/api/README.md` or root `README.md` troubleshooting.
10. **Stretch** — `POST /api/v1/players` REST alias; `COMPLETE_SESSION` server endpoint; queue-lane CRUD replay.

## Build — contracts alignment

### Rename walk-in create action

| Before (web) | After (canonical) |
|--------------|-----------------|
| `CREATE_PLAYER` | `CREATE_PLAYER_PROFILE` |

Update:

- `apps/web/src/mutations/createPlayer.ts`
- `sync-action-labels.ts`, tests, any fixtures
- `packages/contracts` if a typed enum/list of sync actions exists
- `docs/specs/backend/sync-payload-reference.md` — add golden `CREATE_PLAYER_PROFILE` JSON if missing

`createPlayerPayloadSchema` already exists; extend if spec fields missing (`gender`, `notes`, `isActive` defaults).

**Migration:** Existing Dexie outbox rows with `type: "CREATE_PLAYER"` may remain in user browsers. Dispatcher should accept **both** `CREATE_PLAYER` and `CREATE_PLAYER_PROFILE` as aliases for one release, **or** document that clearing site data is required (prefer alias in code).

## Build — API use cases (required)

Each use case must:

- Be callable from `process-sync-actions.ts` **and** optional direct REST route.
- Use Prisma transactions where multiple rows change.
- Throw `UseCaseError` with codes from `api-contracts.md`.
- Support idempotent replay via existing `syncActionLog` infrastructure.

### `CreatePlayerProfile` (P0 — fixes walk-in sync)

Per `sync-actions.md`:

- `entityType`: `playerProfile`
- `entityId`: client-generated profile id
- Payload: `displayName`, `phone?`, `gender?`, `defaultSkillRating`, `notes?`, `isActive`
- Upsert by client id; replay → `already_applied`

### `UpdatePlayerProfile` (P1)

- Payload from `updatePlayerProfilePayloadSchema` (Phase 7 contracts)
- Organizer edits only; do not touch auth/player-owned fields

### `UpdatePayment` (P1)

Per `payments.md`:

- `entityType`: `checkIn`
- Update session payment fields only; replay must not double-count session totals

### `UpdateCheckIn` (P1)

Per `state-transitions.md`:

- Queue status transitions (`waiting`, `resting`, `done`, `removed`, …)
- `suggestionExcluded` / `suggestionExcludeNote`
- Reject illegal transitions with `VALIDATION_ERROR`

### `UpdateMatchResult` (P1)

Per `match-results-and-ratings.md`:

- Correction-only on **completed** matches
- Call domain `recomputeSessionFromMatches` (or existing API helper) forward from corrected match
- Replay must not double-apply rating deltas

### Extend `process-sync-actions.ts`

Add dispatcher cases for all P0 + P1 actions above.

Keep existing Phase 2 actions unchanged.

**Independent action rule:** Per `sync-actions.md`, unrelated failures should not block unrelated actions. After P0 lands, a failed payment update for player A must not block check-in sync for player B (verify or fix if regressed).

## Build — web outbox ordering (P0)

### Current bug

```ts
// flushOutbox(sessionId) → listPendingOutboxActions(sessionId)
// Only returns rows where sessionId matches — skips CREATE_PLAYER_PROFILE (sessionId: "")
```

### Required behavior

When flushing (with or without `sessionId` filter):

1. Load **org-scoped** pending actions: `sessionId` is `""` or missing, types like `CREATE_PLAYER_PROFILE`, `UPDATE_PLAYER_PROFILE` (profile entity without session).
2. Load **session-scoped** pending actions for the target `sessionId` (if provided).
3. Merge and sort by `createdAt` ascending.
4. Process one action at a time (existing loop); stop on first hard failure (Phase 8 behavior).

When `sessionId` is omitted (global flush), process all pending org + session rows by `createdAt`.

### Dependency hint (client-side, MVP)

When marking dependents blocked, treat `CHECK_IN_PLAYER` as depending on a **failed** earlier `CREATE_PLAYER_PROFILE` with the same `playerProfileId` in payload (optional enhancement if ordering alone is insufficient).

### `retryOutboxAction` / `retryFailedOutbox`

Must use the same listing helper so retried walk-ins flush profile create before check-in.

## Build — optional REST endpoints (stretch)

Share use cases with sync — do not duplicate logic.

| Endpoint | Use case |
|----------|----------|
| `POST /api/v1/players` | `CreatePlayerProfile` |
| `PATCH /api/v1/players/:playerId` | `UpdatePlayerProfile` |
| `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId` | `UpdateCheckIn` |
| `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId/payment` | `UpdatePayment` |
| `PATCH /api/v1/sessions/:sessionId/matches/:matchId/result` | `UpdateMatchResult` |

Not required for Phase 9 done criteria if sync replay is complete.

## Build — organizer-visible outcomes

No new UI required. Phase 8 `SyncReviewPanel` should show:

- Walk-in check-ins **clear from failed** after successful retry post-fix.
- Payment/correction/profile actions sync without `SYNC_ACTION_UNKNOWN`.

Optional copy tweak in `sync-action-labels.ts` for `CREATE_PLAYER_PROFILE` → “Add player {name}”.

Update `README.md` **Troubleshooting** with one row:

| Symptom | Cause | Fix |
|---------|-------|-----|
| Sync failed: **Player not found** on check-in | Walk-in profile never reached server (pre–Phase 9) | Upgrade to Phase 9 build; **Retry all failed** on sync panel |

## Tests (required)

### API (`apps/api`)

| Suite | Coverage |
|-------|----------|
| **Walk-in golden chain** | `CREATE_PLAYER_PROFILE` → `CHECK_IN_PLAYER` applied in one batch; idempotent replay |
| **CreatePlayerProfile** | Duplicate action id → `already_applied`; duplicate entity id → no second row |
| **CheckInPlayer** | Still fails with `PLAYER_NOT_FOUND` when profile truly missing (negative test) |
| **UpdatePayment** | Mark paid; replay → `already_applied`; totals not doubled |
| **UpdateMatchResult** | Correction changes outcome; replay idempotent; ratings recomputed once |
| **UpdateCheckIn** | Resting → waiting transition; illegal transition rejected |
| **UpdatePlayerProfile** | Name/rating edit persisted |
| **Ordering** | Batch with profile create **after** check-in in input order → check-in `failed` or `blocked` per spec (server ordering); document expected behavior |

Target **≥20–35** new meaningful API tests.

Use `RUN_DB_TESTS=1` pattern from Phase 2.

### Web (`apps/web`)

| Suite | Coverage |
|-------|----------|
| **flushOutbox walk-in** | `createPlayerLocal` + `checkInPlayerLocal` → mock API receives **profile create before check-in** |
| **Outbox listing** | Org-level `CREATE_PLAYER_PROFILE` included when flushing with `sessionId` |
| **Action rename** | New mutations enqueue `CREATE_PLAYER_PROFILE` |
| **Labels** | `CREATE_PLAYER_PROFILE` plain-language label |

Target **≥8–15** new meaningful web tests. Keep Phase 3–8 tests green.

### Manual smoke (required)

1. Full stack: `pnpm dev`, create session, add walk-in **“Bogs”**, verify sync panel shows **no failed check-in** (or retry succeeds).
2. Mark player paid on payments page → refresh → payment state survives with API up.
3. Correct a completed match on history page → leaderboard updates after sync.
4. Stop API mid-session → queue actions → start API → **Retry all failed** clears backlog for walk-in + payments.

## Done when

- [ ] `pnpm test` at repo root passes
- [ ] `RUN_DB_TESTS=1 pnpm --filter @top-seed/api test` passes with walk-in golden chain
- [ ] `CREATE_PLAYER_PROFILE` sync replay creates PostgreSQL `PlayerProfile` row
- [ ] `flushOutbox(sessionId)` sends profile create **before** check-in for walk-ins
- [ ] Walk-in check-in no longer fails with **Player not found** when API is healthy
- [ ] `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE`, `UPDATE_CHECK_IN` replay on server
- [ ] Idempotent replay for all new action types (no duplicate rows / double rating / double payment totals)
- [ ] `CREATE_PLAYER` alias handled or migrated without breaking existing outbox rows
- [ ] Supported sync action matrix documented (README or `apps/api/README.md`)
- [ ] **Manual smoke** walk-in + payment + correction scenarios pass
- [ ] No player self-service routes, login, PWA, or export/import UI added

## Explicitly out of scope

- Player self-service (`/session/:id/check-in`, player profile routes)
- Login, JWT, roles, multi-organizer permissions
- `mergeSnapshot` / dashboard pull on reconnect
- Export backup download or import restore
- PWA service worker
- Full replay for queue-lane CRUD, `CANCEL_MATCH`, `REMOVE_QUEUED_MATCH`, `MOVE_QUEUED_MATCH_TO_LANE` (Phase 10 unless trivial)
- `GET` list endpoints for payments, matches, leaderboard (server read models)
- `requirePaymentBeforePlay` enforcement
- Realtime (SSE/WebSocket) multi-device dashboard
- Discard-failed-action UI (still out of scope)

## Phase 10+ handoff notes

After Phase 9, organizer local-first flows should **sync reliably** for players, check-ins, queue/match core, payments, corrections, and profile edits.

Natural next increments:

| Theme | Examples |
|-------|----------|
| **Remaining sync catalog** | Queue lane CRUD, `CANCEL_MATCH`, `COMPLETE_SESSION`, `UPDATE_QUEUED_MATCH` |
| **Server read + merge** | `GET` payments/matches/leaderboard; `mergeSnapshot` on connect without clobbering local corrections |
| **Multi-device** | Realtime dashboard, conflict policy beyond retry |
| **Player-facing** | Self check-in, session status, player accounts |
| **Auth & ops** | Organizer login, export/import backup |

## Constraints for the implementer

- **One use case per mutation** — sync dispatcher and REST both call it.
- Call `@top-seed/domain` for rules; fix domain if spec gap found.
- Idempotency is non-negotiable for all new sync actions.
- Preserve Phase 8 failed/blocked semantics — Phase 9 fixes root causes, not retry UX.
- Align action **names** with `sync-actions.md`; update specs if a deliberate rename is required.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `POST /api/v1/players` + `PATCH` REST endpoints
- `COMPLETE_SESSION` server use case + sync replay
- Compound Dexie index `[sessionId+status]` on `syncOutbox` (quiet console warnings)
- API batch ordering: auto-reorder `CREATE_PLAYER_PROFILE` before dependent `CHECK_IN_PLAYER` within a single `POST /sync/actions` request (server-side safety net)
- Seed script adds sample walk-in profile ids for demo parity
