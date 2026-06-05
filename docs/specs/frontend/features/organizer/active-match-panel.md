# ActiveMatchPanel

## User Job

Support match operation from assignment through score or winner recording.

## Data Required

- Active or assigned match.
- Court.
- Team participants.
- Match status.
- Existing score or result.
- Rating impact if available after completion.
- Match sync status for local assignment, start, result, completion, or cancellation.

## Child Components

- `MatchCard`
- `Button`
- `FormField`
- `ConfirmAction`
- `Dialog`
- `SyncStatusBadge`

## Actions Emitted

- `onStartMatch`
- `onRecordScore`
- `onMarkWinner`
- `onCompleteMatch`
- `onCancelMatch`

## Permissions

- Match operations require organizer permission.

## States

- Assigned.
- In progress.
- Recording result.
- Completing.
- Cancel confirmation.
- Completed read-only.
- Error.
- Offline with local match changes pending sync.
- Sync failed for a match action.

## Responsive Composition

- Mobile: prioritize winner/score entry and finish action.
- Tablet: keep team pairing and court visible while recording result.
- Desktop: may show rating impact beside result form.

## Acceptance Criteria

- Cancelled matches do not update ratings.
- Completed scored matches can show rating impact.
- Score entry preserves data on validation error.
- Start, score, complete, and cancel actions update local state immediately and sync later.
