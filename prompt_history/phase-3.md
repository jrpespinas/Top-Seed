# Phase 3 — Local-first client kernel

Implement **Phase 3 only**: durable browser storage, sync outbox, local mutation pipeline, and minimal sync UI stubs in `apps/web`. Do **not** implement the live dashboard pegboard, session lifecycle pages, payments UI, leaderboard, or full `SyncReviewPanel`.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, `packages/contracts`, Fastify health, web shell |
| **1** | `packages/domain` pure rules + tests |
| **2** | Prisma, use cases, `POST /api/v1/sync/actions`, at minimum `CHECK_IN_PLAYER` replay + dashboard snapshot read (can be partial — see scope below) |

This phase makes live session mutations **survive reload and work offline**. The organizer should check in a player with no network, refresh the page, and still see that player with a pending outbox entry.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/architecture.md` — local-first flow diagram and realtime strategy (skim)
3. `docs/specs/frontend/frontend-stack.md` — Dexie + TanStack Query roles
4. `docs/specs/frontend/frontend-technical-standards.md` — **authoritative** for IndexedDB, outbox, PWA/offline rules
5. `docs/specs/backend/sync-actions.md` — action names, request shape, ordering, idempotency
6. `docs/specs/backend/sync-payload-reference.md` — golden JSON for `CHECK_IN_PLAYER` (and any other actions you wire)
7. `docs/specs/mvp-access.md` — no login; session mode only
8. `docs/specs/frontend/components/domain/offline-banner.md` — stub props/copy (skim)
9. `docs/specs/frontend/components/domain/sync-status-badge.md` — stub props/copy (skim)

Do **not** read dashboard feature specs (`queue-panel.md`, `court-board.md`, etc.) or primitive component library specs in this phase.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` primary; extend `packages/contracts` only for sync/outbox Zod types if Phase 2 did not |
| Local DB | **Dexie** (IndexedDB) — not `localStorage` for session data |
| Server coord | **TanStack Query** for sync POST, snapshot fetch, retries |
| Validation | **Zod** — align with `packages/contracts` |
| Domain rules | Call `@top-seed/domain` where transitions/validation apply; do not duplicate business logic in UI |
| Testing | Vitest + `fake-indexeddb` (or Dexie in-memory) for db/mutation unit tests |

**Do not use:** Redux, MobX, or making TanStack Query the sole source of truth for live session state.

## Suggested `apps/web` layout

```text
apps/web/src/
  db/
    database.ts          # Dexie subclass + schema version
    types.ts             # Local record shapes (clientId, syncStatus, …)
  sync/
    outbox.ts            # enqueue, list pending/failed, mark applied/failed
    syncClient.ts        # POST /api/v1/sync/actions
    mergeSnapshot.ts     # merge server dashboard snapshot without clobbering unsynced local state
    connection.ts        # online/offline detection
  mutations/
    applyMutation.ts     # shared: write local → enqueue → return updated view
    checkInPlayer.ts     # first vertical slice
  hooks/
    useLiveSession.ts    # read active session from Dexie (reactive)
    useSyncEngine.ts     # flush outbox when online
  components/
    OfflineBanner.tsx    # stub per spec
    SyncStatusBadge.tsx  # stub per spec
  lib/
    device.ts            # stable deviceId in localStorage (only for deviceId)
```

Keep files boring and explicit. One mutation helper pattern that later phases reuse.

## Build — Dexie schema

Persist at minimum (per `frontend-technical-standards.md` + `domain-model.md` local-first metadata):

| Table | Purpose |
|-------|---------|
| `sessions` | Active/recent session metadata |
| `playerProfiles` | Organizer-managed players (can seed defaults) |
| `checkIns` | Session check-ins with `clientId`, `syncStatus`, `lastSyncedAt`, `lastSyncError` |
| `courts` | Session courts |
| `queueLanes` | Staging lanes |
| `queuedMatches` | Staged matches |
| `matches` | Court matches |
| `syncOutbox` | Pending sync actions (`id`, `type`, `entityType`, `entityId`, `sessionId`, `payload`, `createdAt`, `status`) |

Rules:

- `clientId` / client-generated IDs are stable before server ack.
- `syncStatus` on mutable entities: `local` \| `pending` \| `syncing` \| `synced` \| `failed`.
- Index by `sessionId` where useful for dashboard reads.
- Schema versioning via Dexie `version(n).stores({…})` — start at `v1`.

## Build — mutation pipeline (core pattern)

Every offline-capable mutation must follow:

```text
1. Validate input (Zod + @top-seed/domain where applicable)
2. Write durable local state (Dexie transaction)
3. Enqueue sync action (sync-actions.md shape)
4. Update in-memory/UI subscribers immediately
5. Trigger background sync if online
```

Implement **`checkInPlayer`** as the first end-to-end mutation:

- Creates local `CheckIn` with `queueStatus: waiting`, payment fields from session fee defaults.
- Enqueues `CHECK_IN_PLAYER` with client-generated `actions[].id` and `entityId`.
- Payload matches `sync-actions.md` + `sync-payload-reference.md`.

Export a generic `applyMutation` helper so Phase 5–6 add mutations without reinventing the pipeline.

## Build — sync engine

- **`syncClient`**: `POST /api/v1/sync/actions` using `packages/contracts` envelopes; parse per-action results from `sync-actions.md`.
- **`useSyncEngine`** (or equivalent module):
  - On `online` + active session: flush outbox in order (respect dependency rules from spec).
  - Exponential backoff on failure; mark actions `failed` with recoverable error text.
  - Idempotent replay: if server returns `applied` / `SYNC_ACTION_ALREADY_APPLIED`, mark local row `synced`.
- **Do not** drop failed actions silently — keep until organizer retries (full `SyncReviewPanel` is Phase 8).

## Build — snapshot merge

When online, optionally fetch dashboard snapshot (`GET /api/v1/sessions/:sessionId/dashboard` per `api-contracts.md`).

Merge rules (critical):

- **Never** overwrite local rows with `syncStatus` `pending`, `syncing`, or `failed`.
- **Never** discard in-progress form state (no global store replace).
- Server snapshot may fill in `synced` rows and server-only fields (`serverVersion`, etc.).
- Document merge policy in a short comment atop `mergeSnapshot.ts`.

If Phase 2 snapshot endpoint is not ready, stub merge with a typed interface and test merge logic in isolation.

## Build — UI stubs (minimal)

Wire on the existing sessions placeholder page (or a small **dev harness** route — hide behind `import.meta.env.DEV` if preferred):

| Component | Scope |
|-----------|--------|
| `OfflineBanner` | Props from spec: connection + pending/failed counts + `onRetry` stub |
| `SyncStatusBadge` | Renders `pending` / `synced` / `failed` on check-in rows |

Copy from component specs:

- Offline: `Offline. You can keep running this session.`
- Pending: `N changes pending sync.`
- Failed: `Sync failed for N change(s). Review and retry.`

No `SyncReviewPanel`, no export backup, no pegboard.

## Tests (required)

| Area | Examples |
|------|----------|
| Dexie | Schema opens; write/read check-in survives reload simulation |
| `checkInPlayer` | Creates check-in + outbox row in one transaction |
| Outbox | Enqueue preserves `actions[].id`; pending → applied updates `syncStatus` |
| `mergeSnapshot` | Pending local check-in not overwritten by server snapshot |
| Sync client | Mock `fetch`; parses success/error envelopes |

**Target:** at least **15–25** meaningful tests in `apps/web` (domain tests from Phase 1 remain separate).

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with ≥15 tests covering db + mutations + merge
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] Dexie schema documented in code (table list + indexes)
- [ ] **Manual smoke:** with API stopped, check in a player → reload → player still visible → `syncOutbox` contains `CHECK_IN_PLAYER`
- [ ] **Manual smoke:** start API → sync runs → check-in `syncStatus` becomes `synced` (or documented partial if Phase 2 limited)
- [ ] `OfflineBanner` and `SyncStatusBadge` render on dev/placeholder surface
- [ ] No dashboard pegboard, queue panels, or court board implemented

## Explicitly out of scope

- Live dashboard UI (Phase 6): `PlayerCheckInPanel`, `QueuePanel`, `CourtBoard`, `NextQueuePanel`, etc.
- Session list/create flows (Phase 5) beyond minimal dev harness
- UI primitives library (Phase 4)
- Full `SyncReviewPanel` (Phase 8) — only `onReview` hook/no-op on banner
- PWA service worker / Workbox (optional stretch only)
- `dnd-kit`, player-facing routes, login, export backup
- Wiring every sync action — **only `CHECK_IN_PLAYER` required**; structure must support adding more in later phases
- `requirePaymentBeforePlay` gating

## Phase 2 integration notes

If Phase 2 is partial, this phase must still:

1. Define outbox + local write path completely.
2. Call sync API with real `CHECK_IN_PLAYER` when available.
3. Gracefully handle API unreachable (offline path is the priority).

If `CHECK_IN_PLAYER` use case is missing on the server, document the blocker in PR notes but **do not** skip Dexie/outbox implementation.

## Constraints for the implementer

- Local store is source of truth during live operation; server is backup/sync target.
- Sync action names and payloads must match `sync-actions.md` exactly.
- Use `@top-seed/domain` for `checkInInitialStatus()`, payment validation, etc. — do not fork rules in the web app.
- Prefer boring, explicit code over clever abstractions.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `navigator.onLine` + failed `fetch` dual detection for connection status
- Dexie `liveQuery` hook for reactive session lists
- Queue second mutation (`UPDATE_CHECK_IN` for resting) using same `applyMutation` pattern
- Minimal PWA manifest + vite-plugin-pwa shell cache (no custom SW logic required)
