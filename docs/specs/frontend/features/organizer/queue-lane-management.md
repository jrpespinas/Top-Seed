# QueueLaneManagement

Composed **inside** `NextQueuePanel`. Not a top-level dashboard feature.

Parent spec: `docs/specs/frontend/features/organizer/next-queue-panel.md`.

## User Job

Help the organizer create, rename, delete, and operate multiple generic next-match queue lanes during a live badminton session.

Queue lanes are digital versions of separate pegboard staging columns. In MVP v1 they are flexible organizer-created lanes, such as `Queue 1`, `Queue 2`, or `Warm-up Court Queue`. They should not force skill groups, court bindings, or automated routing yet.

## MVP Scope

Queue lane management is part of the organizer-only live dashboard.

The organizer can:

- Add another queue lane.
- Rename a queue lane.
- Reorder queue lanes when space allows.
- Delete a queue lane after confirmation.
- Delete a non-empty queue lane after confirming that queued matches inside the lane will also be removed.
- Move queued matches between lanes.
- Move any queued match from any lane onto an available court.
- Use auto-prompted suggestions as a helper while retaining manual control.

MVP should start with one default queue lane per session. The default lane can be renamed, but the UI should prevent a session from having zero queue lanes while it is active.

## Data Required

- `QueueLane`: id, sessionId, name, sortOrder, status, createdAt, updatedAt, syncStatus.
- Ordered queued matches grouped by lane.
- Per-lane counts for complete, incomplete, and pending-sync queued matches.
- Available courts for move-to-court actions.
- Local session snapshot for offline lane and queued match operations.
- Sync outbox state for lane and queued match actions.

## Child Components

- `MatchCard`
- `Button`
- `IconButton`
- `DropdownMenu` — see `components/primitives/dropdown-menu.md`
- `Dialog`
- `ConfirmAction`
- `FormField`
- `EmptyState`
- `SyncStatusBadge`

## Actions Emitted

- `onAddQueueLane`
- `onRenameQueueLane`
- `onReorderQueueLane`
- `onDeleteQueueLane`
- `onMoveQueuedMatchToLane`
- `onMoveQueuedMatchToCourt`
- `onAddQueuedMatchToLane`
- `onRemoveQueuedMatch`

## Deletion Behavior

Deleting a queue lane is a destructive organizer action.

Rules:

- If the lane is empty, show a lightweight confirmation.
- If the lane contains queued matches, show a stronger confirmation that names the lane and states how many queued matches will be removed.
- Confirmed deletion removes the lane and its queued matches from the local session snapshot immediately, then enqueues sync actions.
- Deletion must not affect active, assigned, completed, or cancelled matches already moved to courts.
- If only one lane remains in an active session, disable deletion and explain that at least one queue lane is required.

Recommended confirmation copy:

```text
Delete "Queue 2"?
This will also remove 3 queued matches from the next queue. Matches already on courts will not be affected.
```

## Move-To-Court Behavior

The organizer must be able to choose which queued match goes to which court.

Rules:

- When one court is open, the primary action may be `Move to Court 1`.
- When multiple courts are open, require court selection.
- The UI may suggest the best next match and best court, but the organizer must confirm.
- Moving a queued match to a court promotes it into the normal match assignment flow and removes it from its queue lane.
- If the queued match is incomplete, require the organizer to fill missing player slots before moving it to court.

## Offline Behavior

Queue lane actions are local-first MVP actions.

Rules:

- Add, rename, reorder, delete, and move actions must save locally before network sync.
- Lane and queued match records should carry visible sync status when pending or failed.
- If deletion sync fails, keep the local deletion visible but surface recovery in the sync error area.
- Sync replay must be idempotent so double taps or reconnect retries do not duplicate lanes or matches.
- Auto-prompted suggestions must be generated from local session state when offline.

## Responsive Composition

Mobile:

- Show one selected lane at a time with a lane switcher.
- Keep `Add lane`, `Rename`, and `Delete` in an overflow menu.
- Do not require drag-and-drop; provide move buttons and lane pickers.

Tablet:

- Show two to three queue lanes when width allows.
- Keep courts and the selected/primary queue lane visible together.
- Use compact lane headers with counts and sync status.

Desktop:

- Show lanes as vertical columns in the right-side `NextQueuePanel`.
- Allow horizontal scrolling when there are more lanes than fit.
- Keep the suggested next match visually prominent without hiding other lanes.

## Accessibility

- Lane tabs, column headers, and menus must be keyboard reachable.
- Drag-and-drop, if implemented, must have button/menu alternatives for moving matches.
- Confirmation dialogs must describe whether queued matches will be deleted.
- Counts should be text-readable, not color-only.

## Future Direction

Future versions may add:

- Skill-based lanes such as beginner, intermediate, and advanced.
- Optional lane-to-court bindings.
- Auto-fill rules per lane.
- Public/player-visible queue previews.
- Lane templates for recurring sessions.

Do not add these future behaviors to MVP unless explicitly requested.

## Acceptance Criteria

- Organizer can add another queue lane during an active session.
- Organizer can rename queue lanes without interrupting active court play.
- Organizer can delete an empty queue lane after confirmation.
- Organizer can delete a non-empty queue lane after confirming queued matches will be removed.
- Organizer cannot delete the final active queue lane.
- Organizer can move queued matches between lanes.
- Organizer can move any complete queued match from any lane to an available court.
- Auto-prompted suggestions assist the organizer but do not remove manual choice.
- Queue lane actions work offline and show pending or failed sync state.
