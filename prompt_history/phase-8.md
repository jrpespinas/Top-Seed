# Phase 8 — Sync review, recovery, and organizer trust

Implement **Phase 8 only**: ship **`SyncReviewPanel`** as the organizer-facing sync recovery surface; extend the outbox and sync engine for **failed / blocked / pending** visibility and **per-action + retry-all** recovery; wire entry points across live and ended session pages. Optionally add **local session export backup** and **API replay** for Phase 7 sync actions. Do **not** implement player self-service routes, login, payment gateway, or PWA service worker.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, contracts, web shell |
| **1** | `packages/domain` pure rules |
| **2** | API use cases + sync replay for core match/queue actions |
| **3** | Dexie, outbox, `applyMutation`, `flushOutbox`, `retryFailedOutbox`, `OfflineBanner` / `SyncStatusBadge` stubs |
| **4** | UI primitives + domain components (`Drawer`, `DataList`, `ConfirmAction`, …) |
| **5** | Session list/create, `sessionMode` |
| **6** | Live dashboard pegboard, `SessionHeader`, `onReview` hook on banner (no-op or partial) |
| **7** | Payments, history, leaderboard, players pages; `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE` local mutations + outbox |

Phases 3–7 enqueue sync actions during live play. Phase 8 closes the loop: when connectivity returns—or does not—the organizer can **see what failed, understand why, and retry** without losing courtside work or reading developer error codes.

This is the **MVP capstone for local-first trust**: the app already works offline; Phase 8 makes failures **visible and recoverable**.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/mvp-access.md` — sync review is **not** gated by `sessionMode`; retry is recovery, not live queue mutation
3. `docs/specs/frontend/frontend-technical-standards.md` — outbox rules, preserve failed actions, export deferred
4. `docs/specs/backend/sync-actions.md` — ordering, `failed` / `blocked` result semantics, dependency blocking
5. `docs/specs/backend/sync-payload-reference.md` — error shapes organizers should see as plain language
6. `docs/specs/backend/api-contracts.md` — sync result `message` / `errorCode` for client branching
7. `docs/specs/frontend/design-system.md` — offline recovery copy and banner behavior

**Read before implementing:**

| Surface | Spec |
|---------|------|
| `SyncReviewPanel` | `features/organizer/sync-review-panel.md` |
| `SessionHeader` | `features/organizer/session-header.md` — `onReviewSyncIssues` |
| `OfflineBanner` | `components/domain/offline-banner.md` — `onReview` |
| `SyncStatusBadge` | `components/domain/sync-status-badge.md` — optional tap shortcut |

Skim only: dashboard and Phase 7 page specs for where banners/headers already render.

Do **not** implement player-facing routes or login specs.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` primary; extend `apps/api` + `packages/contracts` only where replay/schemas are missing |
| Session store | **Dexie** — extend `syncOutbox` row shape; no second outbox |
| Panel UX | **`Drawer`** overlay (right on desktop/tablet, bottom sheet on mobile) — **no dedicated route** per spec |
| Mutations | Reuse existing `flushOutbox`, `retryFailedOutbox`; add **per-action retry** helpers |
| Labels | `lib/sync-action-labels.ts` — map `OutboxAction.type` + local entity context → plain language |
| Server coord | Existing `POST /api/v1/sync/actions`; optional Phase 8 API handlers for Phase 7 action types |
| Testing | Vitest + `fake-indexeddb` for engine/outbox; `@testing-library/react` for panel + banner wiring |

**Do not use:** Redux, role gates, login, discard-failed-action UI, raw JSON payload display to organizers.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/
    sync/
      SyncReviewPanel.tsx          # drawer overlay — primary deliverable
      SyncActionRow.tsx            # single outbox row (label, context, error, retry)
      sync-review-helpers.ts       # group/sort failed → blocked → pending
  hooks/
    useSyncReview.ts               # liveQuery outbox + session/org context for labels
  lib/
    sync-action-labels.ts          # "Mark Ana paid", "Send match to Court 2", …
  sync/
    outbox.ts                      # extend: blocked status, listBlocked, retryOne
    syncEngine.ts                  # mark dependents blocked; per-action retry
  db/
    types.ts                       # OutboxAction: blocked, blockedByActionId?, retryCount?
    database.ts                    # index blocked if needed
```

Wire panel open state from pages that already show `OfflineBanner` / `SessionHeader`:

- `SessionDashboardPage`
- `SessionListPage`
- `SessionPaymentsPage`, `SessionHistoryPage`, `SessionPlayersPage` (banner or header when counts > 0)
- `LocalSessionDevHarness` (dev)

## Recommended build order (vertical slices)

1. **Outbox + engine** — `blocked` status, dependency marking when a parent action fails, `retryOutboxAction(actionId)`, include `blockedCount` in `useSyncEngine`.
2. **Plain-language labels** — `sync-action-labels.ts` resolving player/court/lane names from Dexie.
3. **`SyncReviewPanel`** — grouped list, retry one, retry all failed, close; no discard, no export in core MVP UI.
4. **Entry points** — `SessionHeader` “Review sync issues”, `OfflineBanner` `onReview`, optional `SyncStatusBadge` tap when failed.
5. **Cross-page wiring** — shared panel state or context so opening from banner on payments page works.
6. **Tests** — engine blocked chain, panel grouping order, retry callbacks.
7. **Stretch** — export backup download; API replay for `UPDATE_PAYMENT` / `UPDATE_MATCH_RESULT` / `UPDATE_PLAYER_PROFILE`.

## Build — outbox and sync engine extensions

Current state (Phase 3–7): `OutboxActionStatus` is `pending | syncing | applied | failed`; `flushOutbox` stops on first failure; `retryFailedOutbox` resets all failed to pending.

Phase 8 must align with `sync-actions.md`:

### Blocked actions

When action **A** fails during `flushOutbox`:

1. Mark **A** `failed` with `errorMessage` (plain language from server `message` or network error).
2. Mark later same-session actions that **depend on A** as `blocked` with `blockedByActionId: A.id`.
3. Do **not** silently drop or auto-retry blocked rows.

Dependency heuristics (MVP — keep explicit and testable):

| Later action | Blocked when earlier failure on… |
|--------------|----------------------------------|
| `MOVE_QUEUED_MATCH_TO_COURT` | Same `queuedMatchId` or referenced `checkIn` participants not synced |
| `START_MATCH` | Same `matchId` promotion failed |
| `COMPLETE_MATCH` | Same `matchId` start failed |
| `UPDATE_MATCH_RESULT` | Same `matchId` complete failed |
| `UPDATE_CHECK_IN` / `UPDATE_PAYMENT` | Same `checkInId` create/check-in failed |
| Default | Any earlier **failed** action in the same `sessionId` with earlier `createdAt` (conservative MVP) |

Document chosen rules in code comments; prefer conservative blocking over silent server 409s.

### Per-action retry

```text
retryOutboxAction(actionId):
  reset failed row → pending
  clear blockedByActionId on direct dependents → pending (optional: only when parent is being retried)
  run flushOutbox(sessionId)
```

`retryAllFailed` may wrap existing `retryFailedOutbox` but must refresh blocked dependents correctly.

### Counts

Extend `countOutboxByStatus` → `{ pending, failed, blocked }`. `useSyncEngine` should expose `blockedCount` and treat `failed > 0` as `syncStatus: failed` (blocked alone may still show pending/warning).

### Entity sync status

On retry success, update related `checkIns` / `matches` / `playerProfiles` `syncStatus` consistently (today only check-ins are updated in some paths — extend symmetrically where Phase 7 mutations set `pending`).

## Build — plain-language action labels

Implement `describeSyncAction(action, context)` returning:

- **label** — e.g. `Mark Ana paid`, `Check in Jordan`, `Record Court 2 result`, `Update player profile`
- **context** — optional subtitle: court name, lane name, player display name

Context resolution from Dexie:

- `checkIn` → `playerDisplayName`
- `match` + `courtId` → court name
- `queuedMatch` + `queueLaneId` → lane name
- `UPDATE_PLAYER_PROFILE` → profile `displayName` (organization-scoped; `sessionId` may be empty)

**Do not** show raw `action.type`, `entityId`, or JSON payloads in the panel (codes OK in dev tools only).

Error display:

- Prefer server `message` from last sync attempt (`errorMessage` on outbox row).
- Fallback: short generic copy + error code in dev builds only.

## Build — `SyncReviewPanel`

Per `sync-review-panel.md`. **Drawer overlay**, not a route.

### Layout

- **Header:** summary — `3 failed · 2 waiting to sync` (include blocked in copy when present).
- **Groups (in order):**
  1. **Failed** — attention first; per-row **Retry**
  2. **Blocked** — badge + reason: `Waiting on an earlier change before this can sync.`
  3. **Pending** — `Waiting to sync.`; usually no row action
- **Footer:** `Retry all failed` (when `failedCount > 0`), `Close`

### Row content

- Plain label + entity context
- `StatusBadge` or compact status
- Error message for failed rows (human-readable)
- `Retry` button on failed rows only (disabled while `syncing` or offline — show `Will retry when back online` for pending offline case)

### Session mode

- Available on **live and ended** sessions whenever outbox has pending/failed/blocked items.
- Ended session read-only rules do **not** hide sync review.

### Explicitly excluded from panel UI (per spec)

- **Discard failed action**
- **Export backup** button in panel (stretch lives elsewhere — see below)

### Props (suggested)

```ts
{
  sessionId?: string;          // filter; omit for org-wide player profile actions on list page
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryAction: (actionId: string) => Promise<void>;
  onRetryAllFailed: () => Promise<void>;
}
```

Use `useSyncReview(sessionId)` for live outbox rows + resolved labels.

## Build — entry point wiring

### `SessionHeader`

Add **Review sync issues** when `failedCount > 0` (or `failed + blocked > 0`):

- Button or link next to `SyncStatusBadge`
- `onReviewSyncIssues` opens `SyncReviewPanel`
- Visible on ended sessions if failures exist

### `OfflineBanner`

Replace no-op `onReview` handlers:

- Dashboard, session list, payments, history, players pages
- Dev harness

Show **Review** when `failedCount > 0` (already in component); optionally show when `blockedCount > 0`.

### `SyncStatusBadge` (optional)

Tap when `status === failed` opens panel — only if it does not conflict with compact layout.

### Auto-open

Do **not** auto-open the drawer on failure (too disruptive courtside). Banner + header are sufficient.

## Build — local session export backup (optional stretch)

`frontend-technical-standards.md` defers export until format is defined. If done criteria are green, add:

### Format (minimal MVP)

Single JSON file download:

```json
{
  "exportedAt": "ISO datetime",
  "deviceId": "...",
  "organizationId": "...",
  "session": { ... },
  "checkIns": [ ... ],
  "courts": [ ... ],
  "queueLanes": [ ... ],
  "queuedMatches": [ ... ],
  "matches": [ ... ],
  "playerProfiles": [ ... ],
  "syncOutbox": [ ... ]
}
```

### UX

- **Not** inside `SyncReviewPanel` in MVP.
- Optional: `SessionHeader` overflow or session list card **Export backup** when session has unsynced/failed actions.
- Confirm: `Download a backup of this session's data on this device?`
- Filename: `top-seed-{sessionName}-{date}.json`

### Scope

- Export only; **no import/restore UI** in Phase 8 (document as future work).

## Build — API integration (optional stretch)

Phase 8 **must not block** on server coverage. Local review/retry is required.

| Item | Priority |
|------|----------|
| `UPDATE_PAYMENT` in `ProcessSyncActions` | Stretch |
| `UPDATE_MATCH_RESULT` in `ProcessSyncActions` | Stretch |
| `UPDATE_PLAYER_PROFILE` in `ProcessSyncActions` | Stretch |
| `UPDATE_CHECK_IN` replay (if not already) | Stretch |

Without API handlers, Phase 7 payment/correction/profile actions may fail sync with server errors — the panel must still show them clearly and allow retry when server support lands.

Document supported replay matrix in PR notes.

## Build — dev ergonomics (optional polish)

If touching setup docs in the same change:

- Prisma reads `apps/api/.env`, not repo root — document `cp .env.example apps/api/.env` in `README.md` (known setup footgun).

## Tests (required)

| Area | Examples |
|------|----------|
| `syncEngine` blocked chain | Check-in fails → later payment action marked `blocked` with `blockedByActionId` |
| `retryOutboxAction` | Resets one failed row; flush re-attempts; blocked child becomes pending when parent succeeds |
| `sync-action-labels` | `UPDATE_PAYMENT` → `Mark {name} paid`; `COMPLETE_MATCH` → court context |
| `sync-review-helpers` | Sort order: failed before blocked before pending |
| `SyncReviewPanel` | Renders groups; retry button calls handler; no discard/export buttons |
| `useSyncEngine` | `blockedCount` updates after dependent marking |
| Banner/header wiring | `Review` opens panel (mock `useSyncReview`) |

Keep Phase 3–7 tests passing. Target **≥15–25** new meaningful tests in `apps/web`.

Use router wrapper when testing pages that mount the panel with `Link` / `useParams`.

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with new Phase 8 tests
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] `SyncReviewPanel` opens from dashboard `OfflineBanner` **Review** and `SessionHeader` when failures exist
- [ ] Failed actions listed **before** blocked and pending
- [ ] Blocked rows show plain-language dependency reason
- [ ] **Retry** on one failed action re-runs sync for that row
- [ ] **Retry all failed** resets and flushes all failed rows for the session
- [ ] Organizers never see raw JSON payloads or internal action IDs as the only UI
- [ ] Panel works on **ended** sessions (recovery after complete)
- [ ] **Manual smoke:** go offline → check in player → go online → verify pending clears OR failure appears in panel with retry
- [ ] **Manual smoke:** force API error (stop API mid-session) → failed payment sync visible → retry after API up
- [ ] No **Discard** control in panel
- [ ] `sessionMode` does **not** block sync review or retry

## Explicitly out of scope

- Player self-service routes, login, share session / QR, public leaderboard
- Payment gateway, accounting exports
- **Discard failed sync action** UI
- Import/restore from export backup
- PWA service worker and app-shell caching implementation
- New pegboard / queue / court / payment features (Phases 6–7 own those surfaces)
- `requirePaymentBeforePlay` gating
- Dedicated `/sync-review` route (drawer only per spec)
- Role-based visibility of sync issues

## Phase 9+ handoff notes

After Phase 8, MVP organizer flows are feature-complete for local-first open play. Natural next increments:

| Theme | Examples |
|-------|----------|
| **Player-facing** | Self check-in, “my next match”, player session status routes |
| **Auth & multi-tenant** | Organizer login, organization switcher, permissions |
| **Server authority** | Full snapshot merge on connect; conflict resolution beyond retry |
| **PWA** | Service worker, install prompt, background sync |
| **Import backup** | Restore exported JSON to Dexie with validation |
| **Realtime** | Live dashboard updates across devices (SSE/WebSocket) |

## Constraints for the implementer

- Local store remains source of truth during live operation; sync review helps recovery, not rollback of local session state.
- Reuse `applyMutation` and existing outbox — do not invent a parallel sync queue.
- Preserve failed and blocked rows until organizer retries successfully.
- Plain-language copy throughout — never expose organizers only to `errorCode` strings.
- Sync action names and payloads must match `sync-actions.md`.
- If a spec conflict appears, update the relevant spec in the same change and note why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- Local JSON **export backup** download (format above; not in panel)
- API replay for `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE`
- `SyncStatusBadge` tap → open panel
- Show sync review entry on session list when any session has failed outbox rows
- `README.md` fix: `apps/api/.env` for Prisma
