# CourtBoard

## User Job

Help the organizer see the `Now` state of the session: all courts, occupied players, open slots, and the next court action.

Desktop display label: **Courts**. Zone header: `Courts · {n} active`.

The board should feel like the court section of a physical pegboard, where each court is a spatial container and players occupy visible Team A / Team B slots.

## Desktop Pegboard Layout

- Courts render in a **vertical stack** inside the right pegboard column.
- Column scrolls when court count exceeds visible height.
- Do not use horizontal court strips or orphan grids on desktop pegboard.

## Data Required

- Courts sorted by `sortOrder`.
- Active match per occupied court.
- Team A and Team B player slots for each occupied or staged court.
- Court availability status.
- Available suggested or manual match assignment.
- Per-court sync status for locally pending court or match actions.

## Child Components

- `CourtCard` — see `components/domain/court-card.md` (idle open visualization, overflow delete, vs roster).
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
- Idle open courts show `0/4` and four visible empty slots (severity of idle capacity is intentional).
- Court cards show Team A | vs | Team B with flat player tokens or dashed empty slots.
- Idle open courts show four `Empty` slots and `0/4` only — no instructional line.
- Footer **Start match** / **Finish match** is full-width primary when assigned or in progress.
- **Delete court** is in card overflow menu with confirm dialog — not a button under each card.
- Occupied courts use court green tint; idle open courts stay neutral.
- Courts remain in session sort order (no pinning actionable courts to top).
- Paused or unavailable courts are excluded from auto-assignment.
- Add court action lives in the **Courts zone header** on desktop pegboard only — not duplicated inside `CourtBoard`.
- Add, pause, reopen, assign, start, and finish actions update local state immediately and can sync later.
- Drag-and-drop may be supported (Phase 11D match → court), but button/menu alternatives are required.
