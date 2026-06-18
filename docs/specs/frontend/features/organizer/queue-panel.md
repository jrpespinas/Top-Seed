# QueuePanel

## User Job

Help the organizer understand who is waiting, resting, done, or removed and adjust player queue state.

State transition rules: `docs/specs/backend/state-transitions.md`.

## Data Required

- Check-ins grouped by queue status.
- Player display name.
- Session rating.
- Wait time.
- Matches played.
- Payment status.
- `suggestionExcluded` and `suggestionExcludeNote` when set.
- Per-player/check-in sync status for locally pending queue changes.

Players with `assigned` or `playing` status appear in **Queued** and **Playing** filter chips on desktop. On mobile, `waiting` / `resting` / `done` / `removed` tabs remain.

## Filter Chips (desktop)

| Chip | Queue statuses shown |
|------|----------------------|
| All | All except `removed` (default) |
| Available | `waiting`, `resting` |
| Queued | `assigned` |
| Playing | `playing` |

Render as horizontal chip row above the player card list. Use `PlayerCard` for each row on desktop pegboard.

## Child Components

- `PlayerCard` (desktop list; `PlayerRow` on mobile or compact contexts)
- `PlayerRow`
- `Tabs`
- `SearchInput`
- `EmptyState`
- `Drawer`
- `PlayerDetailDrawer`
- `Dialog` or `ConfirmAction` for skip note
- `FormField`
- `SyncStatusBadge`

## Actions Emitted

- `onMarkResting`
- `onBackToWaiting`
- `onMarkDone`
- `onRemovePlayer`
- `onRestorePlayer`
- `onSkipFromSuggestions` — `{ checkInId, note? }`; sets `suggestionExcluded: true` via `UPDATE_CHECK_IN`
- `onClearSuggestionSkip` — `{ checkInId }`; sets `suggestionExcluded: false`
- `onOpenPlayerDetails` → opens `PlayerDetailDrawer` for session rating, payment, and profile edits

Deprecated — do not add inline row editors for session rating or profile fields:

- `onEditSessionRating` → use `onOpenPlayerDetails`

## Skip Suggestions UX

**Skip suggestions** temporarily removes a player from auto-suggestion pools while they remain checked in and `waiting`.

Flow:

1. Organizer opens row overflow → **Skip suggestions**.
2. Optional note field (placeholder: `Why skip? (optional)`).
3. Confirm → `UPDATE_CHECK_IN` with `suggestionExcluded: true` and `suggestionExcludeNote` when provided.

Row display when skipped:

- `StatusBadge` or compact label: **Skipped**
- Show note as secondary text or tooltip when present (for example `Skipped — let others play first`).

**Clear skip** in the same overflow menu when `suggestionExcluded` is true.

Rules:

- Skipping does not change `queueStatus` to `resting` or `done`.
- Skipped players may still be manually added to Next lanes or courts.
- Do not use skip for payment enforcement in MVP v1.

Copy:

- Action: `Skip suggestions` / `Clear skip`
- Not: `Ban player` or `Remove from queue`

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

- Queue state changes are available in live sessions.
- Hide queue actions when the session is `completed` or `cancelled`.

## States

- Loading queue.
- No checked-in players.
- Waiting/resting/done/removed tabs.
- Player with suggestion skip active.
- Search filtered empty state.
- Realtime queue update.
- Action error.
- Offline with locally pending player or queue changes.

## Responsive Composition

- Mobile: tabs and compact player rows, secondary actions in drawer or menu.
- Tablet: show key metadata inline.
- Desktop: allow wider filters and more metadata.

## Acceptance Criteria

- Long-waiting players are easy to identify.
- Payment status is visible inline for organizers.
- Session skill rating is visible on the row but edited in `PlayerDetailDrawer`, not inline.
- Row tap or `View details` opens `PlayerDetailDrawer`.
- **Skip suggestions** and **Clear skip** are available from row overflow with optional note.
- Skipped players show a visible **Skipped** indicator and optional note.
- Removed and done players are visually distinct from active queue players.
- Players return to the `waiting` tab automatically after match completion.
- `resting` is available only through explicit organizer action, not auto-applied after matches.
- Queue state changes write locally first and remain visible after reload.
