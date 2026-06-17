# CourtBoard

## User Job

Help the organizer see the `Now` state of the session: all courts, occupied players, open slots, and the next court action.

The board should feel like the court section of a physical pegboard, where each court is a spatial container and players occupy visible Team A / Team B slots.

## Data Required

- Courts sorted by `sortOrder`.
- Active match per occupied court.
- Team A and Team B player slots for each occupied or staged court.
- Court availability status.
- Available suggested or manual match assignment.
- Per-court sync status for locally pending court or match actions.

## Child Components

- `CourtCard`
- `MatchCard`
- `EmptyState`
- `Button`
- `ConfirmAction`
- `SyncStatusBadge`

## Actions Emitted

- `onAssignCourt` (direct override: `CREATE_MATCH`; show skipped-queue messaging)
- `onMoveNextMatchToCourt` (default promote from Next lane)
- `onSetCourtPlayers`
- `onClearCourtSlot`
- `onStartMatch`
- `onFinishMatch`
- `onPauseCourt`
- `onReopenCourt`
- `onCancelMatch`
- `onAddCourt`

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

- Court actions are available in live sessions.
- Hide court actions when the session is `completed` or `cancelled`.

## States

- Loading courts.
- No courts.
- Courts ready.
- Court with empty player slots.
- Court occupied with Team A and Team B.
- Realtime court update.
- Court action error.
- Offline with local pending court changes.

## Responsive Composition

- Mobile: single-column court list, with active or open courts first based on action context.
- Tablet: grid optimized for live operation, keeping courts visible beside next queue.
- Desktop: central grid with the largest dashboard footprint.

## Acceptance Criteria

- Every court has exactly one visible status.
- Court cards show Team A and Team B slots, including empty slots when not full.
- Occupied courts show players by team pair, not as a flat list.
- Paused or unavailable courts are excluded from auto-assignment.
- Open courts make moving the next queued match onto the court easy.
- Direct court assignment shows `Assigned directly — skipped Next queue` messaging.
- Add court, pause/reopen court, and set players actions are visible without leaving the board.
- Add, pause, reopen, unavailable, assign, start, and finish actions update local state immediately and can sync later.
- Drag-and-drop may be supported, but button/menu alternatives are required.
