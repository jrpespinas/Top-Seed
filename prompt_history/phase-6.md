# Phase 6 — Live dashboard pegboard

Implement **Phase 6 only**: replace the dashboard placeholder with the organizer live-session pegboard — check-in, Available pool, Next queue lanes, court board, match lifecycle, and session header/status. Wire real Dexie data, local-first mutations, and offline suggestions. Do **not** implement full payments page, leaderboard page, match history page, `SyncReviewPanel`, or player self-service routes.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, contracts, web shell |
| **1** | `packages/domain` pure rules (`buildSuggestion`, transitions, ratings) |
| **2** | API use cases + sync replay for check-in, queued match, court promote, start/complete match |
| **3** | Dexie, outbox, `applyMutation`, sync engine, merge snapshot |
| **4** | UI primitives, domain components (`PlayerRow`, `CourtCard`, `MatchCard`, …), formatters |
| **5** | Session list/create, `sessionMode`, courts + default lane on create, dashboard route placeholder |

This phase is where an organizer **runs a real open-play night** from `/organizer/sessions/:sessionId/dashboard`: check players in, stage Next matches, send to courts, start/finish matches, and see who is waiting — on phone, tablet, or desktop. Ended sessions stay read-only per `mvp-access.md`.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/mvp-access.md` — **authoritative** for `live` vs `ended`; no login/roles
3. `docs/specs/frontend/pages/organizer-session-dashboard.md` — page composition and acceptance criteria
4. `docs/specs/frontend/organizer-components.md` — canonical names, pegboard zones, deprecated aliases
5. `docs/specs/frontend/design-system.md` — pegboard mental model, mobile bottom tabs (**Now** | **Next** | **Available** | **More**)
6. `docs/specs/frontend/frontend-technical-standards.md` — local-first mutation rules, touch targets
7. `docs/specs/backend/state-transitions.md` — queue status, match states, side effects
8. `docs/specs/backend/queueing-and-ratings.md` — suggestion + staging pipeline copy
9. `docs/specs/backend/sync-actions.md` — action names, payloads, ordering
10. `docs/specs/backend/sync-payload-reference.md` — golden JSON for actions you wire

**Read each feature spec before implementing that feature:**

| Feature | Spec |
|---------|------|
| `SessionHeader` | `features/organizer/session-header.md` |
| `SessionStatusBar` | `features/organizer/session-status-bar.md` |
| `PlayerPool` | `features/organizer/player-pool.md` |
| `PlayerCheckInPanel` | `features/organizer/player-check-in-panel.md` |
| `QueuePanel` | `features/organizer/queue-panel.md` |
| `CourtBoard` | `features/organizer/court-board.md` |
| `NextQueuePanel` | `features/organizer/next-queue-panel.md` |
| `QueueLaneManagement` | `features/organizer/queue-lane-management.md` |
| `ActiveMatchPanel` | `features/organizer/active-match-panel.md` |
| `PlayerDetailDrawer` | `features/organizer/player-detail-drawer.md` |

Skim only (implement compact stubs or defer — see scope):

- `features/organizer/payment-summary-panel.md` — compact totals + link to payments page
- `features/organizer/recent-matches-panel.md` — last few matches; full correction UX can be thin
- `features/organizer/sync-review-panel.md` — hook only; full panel is Phase 8

Do **not** read player-facing page specs or Phase 7 full-page specs in depth unless wiring navigation links.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` primary; extend `packages/contracts` only for missing sync/API payload schemas |
| Session store | **Dexie** — extend local shapes for queued-match participants, match teams, scores |
| Mutations | Reuse `applyMutation` + outbox; one mutation file per action group |
| Domain logic | **`@top-seed/domain`** for suggestions, transitions, rating preview — do not duplicate in UI |
| Suggestions | `buildSuggestion` / `buildSuggestionPool` from `packages/domain` against a local session snapshot |
| Server coord | `POST /api/v1/sync/actions` for replayed actions; direct REST where Phase 2 exposes endpoints |
| UI | Phase 4 primitives + domain components; feature panels under `features/` |
| Layout | CSS grid/flex + `Tabs` for mobile pegboard zones; **no `dnd-kit` required** |
| Testing | Vitest + `fake-indexeddb` for mutations; `@testing-library/react` + router wrapper for panels |

**Do not use:** Redux, role-based gates, login screens, player self-service routes, `SuggestedMatchPanel` / `onAutoFillQueue` naming.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/
    dashboard/
      SessionDashboardPage.tsx    # replaces SessionDashboardPlaceholder
      SessionHeader.tsx
      SessionStatusBar.tsx
      PlayerPool.tsx              # composes check-in + queue panels
      dashboard-layout.tsx        # responsive grid + mobile tabs
    players/
      PlayerCheckInPanel.tsx
      QueuePanel.tsx
      PlayerDetailDrawer.tsx
    queue/
      NextQueuePanel.tsx
      QueueLaneManagement.tsx
      SuggestionStrip.tsx
    courts/
      CourtBoard.tsx
    matches/
      ActiveMatchPanel.tsx        # drawer/dialog from court card
  mutations/
    checkInPlayer.ts              # exists — extend if needed
    createPlayer.ts
    updateCheckIn.ts              # queue status, suggestionExcluded
    createQueueLane.ts
    renameQueueLane.ts
    deleteQueueLane.ts
    reorderQueueLanes.ts
    createQueuedMatch.ts
    updateQueuedMatch.ts
    moveQueuedMatchToLane.ts
    moveQueuedMatchToCourt.ts
    removeQueuedMatch.ts
    createMatch.ts                # direct court assign override
    startMatch.ts
    completeMatch.ts
    cancelMatch.ts
    recordPayment.ts              # minimal for drawer quick-mark-paid
  hooks/
    useSessionDashboard.ts        # liveQuery composite for one sessionId
    useCheckIns.ts
    useCourts.ts
    useQueueLanes.ts
    useQueuedMatches.ts
    useMatches.ts
    useSessionSuggestion.ts       # domain suggestion + regenerate
  lib/
    session-snapshot.ts           # build domain snapshot from Dexie rows
    session-mode.ts               # exists from Phase 5
  routes/
    router.tsx                    # wire SessionDashboardPage
```

Keep `db/`, `sync/`, `components/ui/`, `components/domain/` from prior phases.

## Recommended build order (vertical slices)

Ship in slices so each slice is testable before layering UI polish.

1. **Dexie shape + snapshot** — extend `db/types.ts` for participants/teams; `session-snapshot.ts` feeds `@top-seed/domain`.
2. **Check-in slice** — `createPlayerLocal`, wire `PlayerCheckInPanel` to existing `checkInPlayerLocal`; duplicate check-in guard; search against `playerProfiles`.
3. **Available pool** — `QueuePanel` tabs (waiting/resting/done/removed), `updateCheckInLocal` for resting/back/done/remove/restore/skip suggestions.
4. **Suggestion strip** — `SuggestionStrip` + `useSessionSuggestion`; hide when `queueMode === 'manual'`; accept → `createQueuedMatchLocal`.
5. **Next lanes** — `QueueLaneManagement` CRUD + staged `MatchCard` rows; draft → ready flow; send to court.
6. **Court board** — `CourtBoard` + `moveQueuedMatchToCourtLocal`; direct assign override with skipped-queue copy.
7. **Match lifecycle** — `ActiveMatchPanel`: start, win/loss, draw, unscored, cancel; players return to `waiting`.
8. **Dashboard shell** — `SessionHeader`, `SessionStatusBar`, responsive layout, ended-session read-only mode.
9. **PlayerDetailDrawer** — session rating, payment quick actions, profile fields per spec.
10. **Supporting row** — compact `PaymentSummaryPanel` + `RecentMatchesPanel` stubs with navigation links.

## Build — Dexie schema extensions

Phase 3 tables exist but shapes are minimal. Extend for dashboard reads (additive Dexie `version(n)` migration):

| Table | Add / clarify |
|-------|----------------|
| `queuedMatches` | `teamOnePlayerIds`, `teamTwoPlayerIds` (or join table), `createdFrom`, `syncStatus` |
| `matches` | `queuedMatchId?`, `teamOnePlayerIds`, `teamTwoPlayerIds`, `startedAt`, `completedAt`, result fields |
| `checkIns` | `suggestionExcluded`, `suggestionExcludeNote`, `matchesPlayed` (session counter) if not derived |
| `playerProfiles` | `phone?`, `gender?`, `notes?` for drawer |

Rules:

- Client-generated IDs remain stable before server ack.
- Mutable entities carry `syncStatus` where Phase 3 pattern applies.
- Index `sessionId` on all session-scoped tables.
- Do not store suggestion algorithm state — only domain actions in outbox.

## Build — session mode (reuse Phase 5)

Per `mvp-access.md` and `getSessionMode(status)`:

| Mode | Dashboard behavior |
|------|-------------------|
| **live** | All pegboard actions enabled (with confirmations for destructive ops) |
| **ended** | Read-only view: show courts, lanes, check-ins, recent matches; hide check-in, queue mutations, court actions, payment edits |

Pass `sessionMode` into every feature panel. No `Permission denied` UI. No role props.

## Build — session snapshot for domain

Implement `buildSessionSnapshot(sessionId)` that loads session, check-ins, courts, lanes, queued matches, and active matches from Dexie and maps to `@top-seed/domain` types.

Use for:

- `buildSuggestion` / `buildSuggestionPool`
- Transition validation before local writes (where domain exports helpers)
- Offline operation — suggestions must work without network

## Build — `SessionDashboardPage`

Route: `/organizer/sessions/:sessionId/dashboard` — **replace** `SessionDashboardPlaceholder`.

Composition per `organizer-session-dashboard.md`:

```text
SessionDashboardPage
├── OfflineBanner + sync status (session-scoped useSyncEngine)
├── SessionHeader
├── SessionStatusBar
├── [pegboard zone — layout varies by breakpoint]
│   ├── PlayerPool (Available)
│   ├── CourtBoard (Now)
│   └── NextQueuePanel (Next)
├── PaymentSummaryPanel (compact)
├── RecentMatchesPanel (compact)
├── PlayerDetailDrawer (overlay)
└── SyncReviewPanel hook (onReview → toast or no-op until Phase 8)
```

**Desktop:** three-column pegboard — Available left, Courts center (largest), Next right.

**Tablet:** Courts + Next visible together; PlayerPool below or beside per width.

**Mobile:** bottom `Tabs` — **Now** (default) | **Next** | **Available** | **More** (payments preview, recent matches, session links). Do not cram all zones into one scroll.

Loading / empty states per page spec: no courts, no check-ins, active dashboard, ended read-only, offline pending sync.

## Build — `SessionHeader`

Per `session-header.md`:

- Session name, venue, date/time, status badge, fee, court count
- Connection + sync badge (`SyncStatusBadge`), pending/failed counts
- Live actions: **Complete session** (`completeSessionLocal` from Phase 5), **Cancel session** (mutation + outbox if API ready; local stub OK)
- **Retry sync** → `useSyncEngine.retry()`
- **Review sync issues** → no-op or navigate stub until Phase 8
- Hide live actions when `sessionMode === 'ended'`
- No Share session, no role badge

## Build — `SessionStatusBar`

Per `session-status-bar.md`:

- Metric cards: checked in, waiting, active matches, open courts, unpaid count, collected amount
- `onFilterWaiting` / `onFilterUnpaid` scroll or switch tabs to relevant pool
- `onViewPayments` → link to `/organizer/sessions/:sessionId/payments` (page can 404 stub until Phase 7)
- Derive counts from Dexie `liveQuery` — no vanity analytics

## Build — `PlayerCheckInPanel`

Per `player-check-in-panel.md`. Wire to real mutations:

1. Search `playerProfiles` (local; optional server search later).
2. **Check in** returning player → `checkInPlayerLocal` with session fee as `paymentAmountDue`, optional session skill rating.
3. **New walk-in** → `createPlayerLocal` (display name required) then check in.
4. Block duplicate active check-in with clear message.
5. `sessionMode === 'ended'` → hide panel inputs.

Remove dependence on `LocalSessionDevHarness` for check-in smoke tests.

## Build — `QueuePanel`

Per `queue-panel.md`:

- Tabs: Waiting | Resting | Done | Removed
- `PlayerRow` with wait time, rating, payment badge, sync status
- Row actions → `updateCheckInLocal`: mark resting, back to waiting, mark done, remove, restore
- **Skip suggestions** / **Clear skip** → `UPDATE_CHECK_IN` outbox
- `onOpenPlayerDetails` → `PlayerDetailDrawer`
- Hide `assigned` / `playing` players (they appear on Next/court cards)

## Build — `NextQueuePanel` + `QueueLaneManagement`

Per `next-queue-panel.md` and `queue-lane-management.md`.

### Suggestion strip (top)

- Global **Suggested next match** card above lane columns when `queueMode === 'suggested'`
- Show Team 1 / Team 2, explanation, warnings (unpaid, repeat partner, no open court)
- Actions: **Add to [lane name]**, **Regenerate**, swap player, swap teams (preview only until accept)
- When `queueMode === 'manual'`: hide strip; show `Manual queue mode — build matches in Next lanes`
- Accept stages via `createQueuedMatchLocal` — **never** assigns court directly from suggestion primary button

### Lane columns (below)

- Lane CRUD: add, rename, reorder, delete (confirm non-empty lane)
- Cannot delete last lane on active session
- Staged `MatchCard` rows: `queued`, `queuedIncomplete`, `ready`
- **Add match** → empty draft in selected lane; fill slots one at a time
- Draft → `ready` when four players assigned; only `ready` may **Send to court**
- Move between lanes, remove from queue
- Selected lane targets accept/add-empty-match when multiple lanes exist

Copy per spec: **Send to court**, **Assigned directly — skipped Next queue**, **Needs N player(s)**.

**Deprecated — do not implement:** `onAutoFillQueue`, **Auto-fill**, `SuggestedMatchPanel`.

## Build — `CourtBoard`

Per `court-board.md`:

- Grid of `CourtCard` sorted by `sortOrder`
- Team A / Team B slots per court; empty slots visible
- Open court: **Send to court** from selected staged match (with court picker when multiple open)
- Direct override: **Assign players** → `createMatchLocal`; show skipped-queue messaging
- Occupied court: **Start match** → `startMatchLocal`; open `ActiveMatchPanel` for in-progress
- Pause/reopen court, add court (optional if trivial)
- `sessionMode === 'ended'` → read-only cards, no actions

Button/menu paths required; drag-and-drop optional stretch only.

## Build — `ActiveMatchPanel`

Per `active-match-panel.md`. Open from court card when match is `assigned` or `in_progress`:

| State | Primary action |
|-------|----------------|
| Assigned | **Start match** |
| In progress | Record winner, draw, unscored, or cancel |

- `completeMatchLocal` with result payload per `sync-actions.md` / `match-results-and-ratings.md`
- Rated sessions: show rating impact preview when domain provides it
- Casual: explain stats update without rating change
- Cancelled matches do not affect ratings
- On complete: players return to `waiting` per `state-transitions.md`

## Build — `PlayerDetailDrawer`

Per `player-detail-drawer.md` — minimum viable for Phase 6:

**This session section:** queue status, wait time, session skill rating (editable), payment status quick edit, queue actions, skip suggestions.

**Profile section:** display name, phone, gender, default skill rating, notes — editable with local-first profile mutation + outbox.

Defer full W-L-D session stats if expensive; show placeholders only if domain snapshot already provides them.

## Build — compact supporting panels

### `PaymentSummaryPanel` (dashboard compact)

- Expected vs collected totals, unpaid count from check-ins
- Preview list of unpaid/partial players (top 3–5)
- **View all payments** link → payments route (Phase 7 page can be stub)
- Quick **Mark paid** from preview row → `recordPaymentLocal` if mutation exists; else link only

### `RecentMatchesPanel` (dashboard compact)

- Last 5 completed/cancelled matches from Dexie
- `MatchCard` read-only rows
- **View history** link → history route (Phase 7)
- `onCorrectResult` — thin stub or defer to Phase 7 if correction is large

## Build — mutations catalog

Every mutation: validate (Zod + domain) → Dexie transaction → enqueue outbox → return updated view.

| Mutation | Sync action(s) | Notes |
|----------|----------------|-------|
| `createPlayerLocal` | `CREATE_PLAYER` | Minimal profile |
| `checkInPlayerLocal` | `CHECK_IN_PLAYER` | Exists |
| `updateCheckInLocal` | `UPDATE_CHECK_IN` | Queue status, skip flags, rating |
| `createQueueLaneLocal` | `CREATE_QUEUE_LANE` | |
| `renameQueueLaneLocal` | `UPDATE_QUEUE_LANE` | |
| `deleteQueueLaneLocal` | `DELETE_QUEUE_LANE` | Remove lane queued matches locally |
| `reorderQueueLanesLocal` | `REORDER_QUEUE_LANES` | |
| `createQueuedMatchLocal` | `CREATE_QUEUED_MATCH` | **Server replay exists** |
| `updateQueuedMatchLocal` | `UPDATE_QUEUED_MATCH` | Slot fill, swap |
| `moveQueuedMatchToLaneLocal` | `MOVE_QUEUED_MATCH_TO_LANE` | |
| `moveQueuedMatchToCourtLocal` | `MOVE_QUEUED_MATCH_TO_COURT` | **Server replay exists** |
| `removeQueuedMatchLocal` | `REMOVE_QUEUED_MATCH` | |
| `createMatchLocal` | `CREATE_MATCH` | Direct court override |
| `startMatchLocal` | `START_MATCH` | **Server replay exists** |
| `completeMatchLocal` | `COMPLETE_MATCH` | **Server replay exists** |
| `cancelMatchLocal` | `CANCEL_MATCH` | |
| `recordPaymentLocal` | `RECORD_PAYMENT` or `UPDATE_CHECK_IN` | Per sync-actions.md |

Enqueue stable `action.id` from caller when tests need determinism. Respect ordering rules in `sync-actions.md` (lane before queued match, check-in before match participant, etc.).

Trigger `flushOutbox` / `useSyncEngine` after mutations when online.

## Build — API integration

**Server replay already supports (Phase 2):** `CHECK_IN_PLAYER`, `CREATE_QUEUED_MATCH`, `MOVE_QUEUED_MATCH_TO_COURT`, `START_MATCH`, `COMPLETE_MATCH`.

**Likely local-only + outbox until stretch:** `UPDATE_CHECK_IN`, queue lane CRUD, `UPDATE_QUEUED_MATCH`, `CREATE_MATCH`, `CANCEL_MATCH`, payment actions, `CREATE_PLAYER`.

When online:

1. Prefer existing `postSyncActions` path for supported action types.
2. Optional: `GET /api/v1/sessions/:sessionId/dashboard` snapshot merge via `mergeSnapshot` on connect — do not clobber unsynced local rows.
3. Direct REST endpoints per `api-spec.md` where implemented and simpler than sync.

Document gaps in PR notes. **Do not block Phase 6** on full server replay for every action — local path must work offline.

## Build — contracts (if needed)

Add to `packages/contracts` only if missing:

- Payload schemas for `UPDATE_CHECK_IN`, `CREATE_QUEUE_LANE`, `UPDATE_QUEUE_LANE`, `DELETE_QUEUE_LANE`, `UPDATE_QUEUED_MATCH`, `CREATE_MATCH`, `CANCEL_MATCH`
- Dashboard snapshot DTO helpers if merging server read

Keep aligned with `sync-actions.md` and `sync-payload-reference.md`.

## Tests (required)

| Area | Examples |
|------|----------|
| `session-snapshot` | Maps Dexie rows to domain snapshot |
| `useSessionSuggestion` | Four waiting players → non-null suggestion; manual mode → hidden |
| `createQueuedMatchLocal` | Draft incomplete → ready at 4 players; outbox payload |
| `moveQueuedMatchToCourtLocal` | Creates match + updates check-in statuses |
| `completeMatchLocal` | Win returns players to waiting; enqueues `COMPLETE_MATCH` |
| `updateCheckInLocal` | Resting, skip suggestions flags |
| `deleteQueueLaneLocal` | Removes queued matches in lane; not court matches |
| `QueuePanel` | Waiting tab renders check-ins; ended mode hides actions |
| `SuggestionStrip` | Accept calls mutation; manual mode hidden |
| `CourtBoard` | Renders courts; open court shows send action |
| `SessionDashboardPage` | Ended session hides check-in panel (smoke) |

Keep Phase 3–5 tests passing. Target **≥30–50** new meaningful tests in `apps/web` (mutations + key panels).

Use router wrapper in component tests (minimal TanStack `createMemoryHistory` route) when components use `Link`.

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with new dashboard tests
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] `/organizer/sessions/:sessionId/dashboard` shows full pegboard for live sessions (not placeholder)
- [ ] **Manual smoke:** create session → check in 4+ players → see suggestion → add to Next → send to court → start → complete match → players back in Available
- [ ] **Manual smoke:** manual `queueMode` session hides suggestion strip; organizer can build draft match in lane
- [ ] **Manual smoke:** mark session completed from header or list → dashboard read-only
- [ ] **Manual smoke (offline):** check in player with API stopped → reload → player visible + outbox pending
- [ ] **Manual smoke (mobile viewport):** Now / Next / Available tabs switch pegboard zones
- [ ] `sessionMode` gates actions (no role checks)
- [ ] Dev harness no longer required for primary check-in flow

## Explicitly out of scope

- **Phase 7:** full `/payments`, `/leaderboard`, `/history`, `/players` pages; deep result correction UX; session leaderboard preview widget
- **Phase 8:** full `SyncReviewPanel`, export backup
- `dnd-kit` drag-and-drop (optional stretch only)
- Player routes, login, share session / QR
- `requirePaymentBeforePlay` gating
- PWA service worker
- Full session edit form (`PATCH` session) — defer unless trivial
- `onAutoFillQueue`, `SuggestedMatchPanel`, **Auto-fill** / **Magic Queue** UI
- New API modules beyond optional snapshot merge / missing sync replay

## Phase 7 handoff notes

Phase 7 should flesh out navigation targets already linked from the dashboard:

- `/organizer/sessions/:sessionId/payments` — full payment table and filters
- `/organizer/sessions/:sessionId/history` — paginated match history + correction
- `/organizer/leaderboard?sessionId=:sessionId` — session leaderboard
- `/organizer/sessions/:sessionId/players` — bulk player management

Dashboard compact panels become thin summaries that deep-link to these pages. Dexie remains source of truth during live play; Phase 7 pages read the same tables.

## Constraints for the implementer

- Local store remains source of truth during operation; server syncs when available.
- Reuse `applyMutation` — do not invent a second mutation pipeline.
- Feature components are presentational: parents/hooks own Dexie reads and mutations.
- Use Phase 4 components; pegboard layout uses design tokens, not one-off CSS.
- Call `@top-seed/domain` for suggestions and transition rules.
- Sync action names and payloads must match `sync-actions.md`.
- If a spec conflict appears, update the relevant spec in the same change and note why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `dnd-kit` for desktop player slot assignment (must keep button/menu alternatives)
- `GET /api/v1/sessions/:sessionId/dashboard` + `mergeSnapshot` on connect
- Server replay for `UPDATE_CHECK_IN`, queue lane CRUD, `CREATE_MATCH`, `CANCEL_MATCH`
- `PlayerDetailDrawer` full W-L-D session stats from domain
- `RecentMatchesPanel` inline result correction
- Add court from dashboard (`CREATE_COURT`)
- Leaderboard preview top-5 on dashboard supporting row
