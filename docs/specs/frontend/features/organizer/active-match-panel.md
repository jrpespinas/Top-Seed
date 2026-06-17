# ActiveMatchPanel

## User Job

Support match operation from assignment through explicit start, score or winner recording, and completion.

State transition rules: `docs/specs/backend/state-transitions.md`.

## Data Required

- Active or assigned match.
- Court.
- Team participants.
- Match status.
- Existing score or result.
- Session `ratingMode`.
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
- `onMarkDraw`
- `onMarkUnscored`
- `onCompleteMatch`
- `onCancelMatch`

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

- Match operations are available in live sessions.
- Hide match actions when the session is `completed` or `cancelled`.

## States

- Assigned: roster on court; primary action is `Start match`.
- In progress: play has started; primary action is finish or record result.
- Recording result.
- Recording draw.
- Recording unscored completion.
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

- Assigned matches require an explicit `Start match` action before completion.
- Cancelled matches do not update ratings.
- Completed win/loss matches can show rating impact when the session is rated.
- Draws are recorded as draws, not wins for both sides.
- Rated draws can show small expectation-based rating impact.
- Unscored completions count as played but do not show rating impact.
- Casual sessions explain that results update stats/history but not ratings.
- Score entry preserves data on validation error.
- Start, score, complete, and cancel actions update local state immediately and sync later.
