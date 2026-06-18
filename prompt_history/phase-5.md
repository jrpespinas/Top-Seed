# Phase 5 — Session lifecycle pages

Implement **Phase 5 only**: organizer session list, create-session flow, local-first session mutations, and `sessionMode` (`live` vs `ended`) wiring. Replace the Phase 3 dev harness as the primary sessions UX. Do **not** implement the live dashboard pegboard, payments page, leaderboard, or full `SessionHeader` / complete-session flows on the dashboard.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, contracts, web shell |
| **1** | `packages/domain` pure rules |
| **2** | `POST /api/v1/sessions`, `POST .../start`, check-in + sync (partial OK) |
| **3** | Dexie, outbox, `applyMutation`, sync engine, merge |
| **4** | UI primitives, domain components, formatters, design tokens |

This phase lets an organizer **create, list, resume, and distinguish ended sessions** before Phase 6 builds the pegboard dashboard. A new open-play night is a **new session**; a completed session stays **read-only** for that `sessionId`.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/mvp-access.md` — **authoritative** for `live` vs `ended`; no login/roles
3. `docs/specs/frontend/pages/organizer-sessions.md` — session list page
4. `docs/specs/frontend/pages/organizer-session-new.md` — create form
5. `docs/specs/frontend/pages/main-entry.md` — root redirect behavior (skim)
6. `docs/specs/backend/sync-actions.md` — `CREATE_SESSION`, `START_SESSION` payloads
7. `docs/specs/backend/api-spec.md` — session lifecycle endpoints (skim)
8. `docs/specs/backend/api-contracts.md` — `SessionDto`, list/create envelopes
9. `docs/specs/frontend/frontend-technical-standards.md` — local-first mutation rules

Do **not** read dashboard feature specs (`queue-panel.md`, `court-board.md`, `session-header.md`, etc.) except to avoid implementing them.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` primary; extend `packages/contracts` only if create-session request schemas are missing |
| Session store | **Dexie** `sessions`, `courts`, `queueLanes` tables (already in schema) |
| Mutations | Reuse `applyMutation` + outbox pattern from Phase 3 |
| Server coord | Direct `POST /api/v1/sessions` + `POST .../start` when online; sync outbox for offline/retry |
| UI | Phase 4 `Button`, `FormField`, `Select`, `Card`, `EmptyState`, `StatusBadge`, `ConfirmAction` |
| Validation | **Zod** aligned with `packages/contracts` |
| Testing | Vitest + `fake-indexeddb` for mutations; `@testing-library/react` for pages |

**Do not use:** Redux, role-based gates, login screens, player self-service routes.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/sessions/
    SessionListPage.tsx       # /organizer/sessions
    NewSessionPage.tsx        # /organizer/sessions/new
    SessionListCard.tsx       # single row/card
    session-form.ts           # Zod schema + defaults
  mutations/
    createSession.ts          # local session + courts + lane + outbox
    startSession.ts           # status draft/open → active (if split)
  hooks/
    useSessions.ts            # liveQuery over db.sessions
    useSessionMode.ts         # live | ended from status
  lib/
    session-mode.ts           # isLiveSession(status), isEndedSession(status)
  routes/
    router.tsx                # wire real pages; demote dev harness
```

Keep `db/`, `sync/`, `components/ui/`, `components/domain/` from prior phases.

## Build — session mode helper

Per `mvp-access.md`:

| Status | Mode | UI behavior |
|--------|------|-------------|
| `draft`, `open`, `active` | **live** | Normal navigation; dashboard placeholder may show “coming in Phase 6” |
| `completed`, `cancelled` | **ended** | Read-only: hide create-and-open live ops; show “View dashboard (read-only)” |

Export `getSessionMode(status): 'live' | 'ended'` and use on list cards and routes. Pass `sessionMode` to domain components when previewing ended sessions.

No `Permission denied` UI. No role props.

## Build — create session (local-first)

Implement `createSessionLocal` using `applyMutation`:

1. Validate form with Zod (`name`, `venueName`, `startsAt`, `feeAmount`, `currency`, `queueMode`, `ratingMode`, `courtCount`).
2. In one Dexie transaction:
   - Insert `LocalSession` with client-generated `id`, `status: 'draft'` (or `active` if create-and-start).
   - Insert default `queueLanes` (at least one `"Next"` lane).
   - Insert `courts` (`Court 1` … `Court N`, default `courtCount` 2–6).
3. Enqueue sync action(s):
   - `CREATE_SESSION` with payload per `sync-actions.md` (`name`, `venueName`, `startsAt`, `feeAmount`, `currency`, `queueMode`, `ratingMode`; omit or force `requirePaymentBeforePlay: false`).
   - If product flow is **create and open**: also enqueue `START_SESSION` (or call `startSession` locally + `START_SESSION` outbox).
4. Trigger sync when online.

Defaults per `organizer-session-new.md`:

- `queueMode`: `suggested`
- `ratingMode`: `casual`
- `currency`: `PHP` (or from org defaults stub)
- `courtCount`: 2

**Rated mode copy:** short helper text that wins/draws may change ratings; unscored/cancelled do not.

**Manual queue copy:** explain suggestion strip is hidden on dashboard (Phase 6); lanes still work.

## Build — session list page

Route: `/organizer/sessions` per `organizer-sessions.md`.

| Element | Behavior |
|---------|----------|
| Header | Title + **Create session** → `/organizer/sessions/new` |
| List | Read from Dexie via `useSessions` (newest first or by `startsAt`) |
| Card | Name, venue, date/time, `StatusBadge`, optional check-in count if cheap |
| Primary action | **Open** → `/organizer/sessions/:sessionId/dashboard` |
| Filters | Status filter chips (`active`, `completed`, `all`) — simple client-side |
| Empty | `EmptyState` + create CTA |
| Offline | `OfflineBanner` at page level (session-agnostic or most recent active) |

**Ended sessions:** card shows read-only badge; primary action label **View session** (same route; dashboard respects `sessionMode`).

Optional secondary action on **live** sessions: **Mark complete** with `ConfirmAction` → local status `completed` + outbox `COMPLETE_SESSION` (implement mutation stub if API/sync not ready; document gap).

Remove or collapse Phase 3 `LocalSessionDevHarness` from the main list — keep behind `import.meta.env.DEV` link only if still useful for check-in smoke tests.

## Build — new session page

Route: `/organizer/sessions/new` per `organizer-session-new.md`.

Form fields:

- Session name (required)
- Venue name (required)
- Start date/time (required, `datetime-local` or split date + time)
- Session fee + currency
- Court count (2–8)
- Queue mode: Suggested / Manual (`Select`)
- Rating mode: Casual / Rated (`Select`)

Actions:

- **Create session** — validates, runs `createSessionLocal`, navigates to dashboard route
- **Cancel** — back to list

Mobile: sticky footer submit using `Button` `large`.

## Build — navigation & root behavior

Update `router.tsx`:

- `/organizer/sessions` → `SessionListPage`
- `/organizer/sessions/new` → `NewSessionPage`
- `/organizer/sessions/$sessionId/dashboard` → placeholder that reads session from Dexie, shows `sessionMode`, and states “Live dashboard — Phase 6” (no pegboard)

Optional root (`/`): if exactly one `active` session in Dexie, redirect to its dashboard; else redirect to sessions list (per `main-entry.md`).

## Build — API integration

When online, prefer:

1. `POST /api/v1/sessions` with client `id` if API accepts client-generated IDs (match Phase 2 `createSession` input).
2. `POST /api/v1/sessions/:sessionId/start` when starting immediately.

If direct POST succeeds, still keep Dexie as source of truth; mark session `synced`.

**Phase 2 gaps (handle explicitly):**

- `CREATE_SESSION` / `START_SESSION` may not be wired in `ProcessSyncActions` yet — outbox + local path must still work offline; document in PR notes if sync replay is REST-only for now.
- `GET /api/v1/sessions` may not exist — **list from Dexie only** in this phase; optional snapshot merge when endpoint lands later.

Do **not** block Phase 5 on full server session list.

## Build — contracts (if needed)

Add to `packages/contracts` only if missing:

- `createSessionRequestSchema` / body for `POST /api/v1/sessions`
- `createSessionPayloadSchema` for sync `CREATE_SESSION`
- `startSessionPayloadSchema` for `START_SESSION`

Keep aligned with `sync-actions.md` and existing `SessionDto`.

## Tests (required)

| Area | Examples |
|------|----------|
| `session-mode` | `active` → live; `completed` → ended |
| `createSessionLocal` | Writes session + courts + lane + outbox in one transaction |
| Form schema | Rejects missing name/venue; defaults `queueMode`/`ratingMode` |
| `SessionListPage` | Renders empty state; renders cards from mock Dexie data |
| `NewSessionPage` | Shows validation errors; submit calls mutation (mocked) |
| Outbox | `CREATE_SESSION` action id stable; payload matches contracts |

Keep Phase 3/4 tests passing. Target **≥15–25** new meaningful tests in `apps/web`.

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with new session tests
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] `/organizer/sessions` lists sessions from Dexie with status filters and empty state
- [ ] `/organizer/sessions/new` creates a session and navigates to dashboard route
- [ ] **Manual smoke:** create Session A → open dashboard placeholder → back → create Session B → both visible in list
- [ ] **Manual smoke:** mark Session A `completed` (UI or mutation) → list shows ended/read-only → Session B still live
- [ ] **Manual smoke (offline):** create session with API stopped → reload → session still in list + outbox has `CREATE_SESSION`
- [ ] `sessionMode` derived from status only (no role checks)
- [ ] No pegboard, `PlayerCheckInPanel`, `CourtBoard`, or queue panels

## Explicitly out of scope

- **Phase 6:** live dashboard pegboard, check-in panel, queue/court features, `SessionHeader`, `SessionStatusBar`
- **Phase 7:** payments page, leaderboard, match history pages
- **Phase 8:** `SyncReviewPanel`, export backup
- Full session edit form (`PATCH` session) — defer unless trivial
- `POST /api/v1/sessions/:sessionId/complete` UI on dashboard (list-level complete OK for ended-mode demo)
- Player routes, login, share session / QR
- `requirePaymentBeforePlay` gating
- Wiring check-in to real session list (Phase 6; dev harness check-in optional)

## Phase 6 handoff notes

Phase 6 should open `/organizer/sessions/:sessionId/dashboard` with a real pegboard, reading the same Dexie session row and respecting `getSessionMode(session.status)`. Session create defaults (`queueMode`, `ratingMode`, courts, lane) must already exist locally.

## Constraints for the implementer

- Local store remains source of truth during operation; server syncs when available.
- Reuse `applyMutation` — do not invent a second mutation pipeline.
- Use Phase 4 components; no one-off form styling.
- Sync action names and payloads must match `sync-actions.md`.
- If a spec conflict appears, update the relevant spec in the same change and note why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `GET /api/v1/sessions` in `apps/api` + merge into Dexie on connect
- `CREATE_SESSION` / `START_SESSION` replay in `ProcessSyncActions`
- Root auto-resume single active session
- Remember last venue/fee defaults in `localStorage` (organizer convenience only)
- Session list check-in / player counts from Dexie aggregates
