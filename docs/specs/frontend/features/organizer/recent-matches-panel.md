# RecentMatchesPanel

## User Job

Give the organizer recent match context and access to result correction when appropriate.

## Data Required

- Recently completed matches.
- Cancelled matches when useful.
- Match scores, winners, courts, and timestamps.
- Correction permission.
- Sync status for locally completed or corrected matches.

## Child Components

- `MatchCard`
- `EmptyState`
- `Button`
- `Drawer`
- `SyncStatusBadge`

## Actions Emitted

- `onViewMatch`
- `onCorrectResult`

## Permissions

- Result correction requires organizer permission.

## States

- Loading matches.
- No completed matches.
- Recent matches ready.
- Correction in progress.
- Error.
- Offline with locally completed matches.
- Sync failed for result correction or completion.

## Responsive Composition

- Mobile: compact list with view details.
- Tablet: panel below or beside queue.
- Desktop: may show more history rows.

## Acceptance Criteria

- Completed and cancelled matches are visually distinct.
- Result correction is not available to players.
- Correcting a result routes through rating recalculation when implemented.
- Locally completed matches appear immediately before backend sync.
