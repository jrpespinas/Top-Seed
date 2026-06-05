# QueuePanel

## User Job

Help the organizer understand who is waiting, resting, done, or removed and adjust player queue state.

## Data Required

- Check-ins grouped by queue status.
- Player display name.
- Session rating.
- Wait time.
- Matches played.
- Payment status.
- Per-player/check-in sync status for locally pending queue changes.

## Child Components

- `PlayerRow`
- `Tabs`
- `SearchInput`
- `EmptyState`
- `Drawer`
- `SyncStatusBadge`

## Actions Emitted

- `onEditSessionRating`
- `onMarkResting`
- `onMarkDone`
- `onRemovePlayer`
- `onRestorePlayer`
- `onOpenPlayerDetails`

## Permissions

- Queue state changes require organizer permission.

## States

- Loading queue.
- No checked-in players.
- Waiting/resting/done/removed tabs.
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
- Removed and done players are visually distinct from active queue players.
- Queue state changes write locally first and remain visible after reload.
