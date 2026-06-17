# RecentMatchesPanel

## User Job

Give the organizer recent match context and access to result correction when appropriate.

## Data Required

- Recently completed matches.
- Cancelled matches when useful.
- Match scores, outcomes, winners, draws, courts, and timestamps.
- Correction availability from session mode and result rules.
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

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

- Result correction is available in live sessions when result rules allow it.
- Hide correction actions when the session is `completed` or `cancelled`, unless viewing history in read-only mode.

## States

- Loading matches.
- No completed matches.
- Recent matches ready.
- Draw or unscored recent match.
- Correction in progress.
- **Stats refreshing** after correction (inline callout on affected row).
- Error.
- Offline with locally completed matches.
- Sync failed for result correction or completion.

## Correction UX

After `onCorrectResult` succeeds locally:

- Show callout on the match row: `Result updated — stats refreshing`.
- Clear callout when leaderboard/rating recompute completes or sync confirms `sideEffects.leaderboardRecomputed`.
- If recompute is session-scoped only, optional footnote: `Ratings updated for this session`.

See `docs/specs/backend/match-results-and-ratings.md` § Correction freshness UX.

## Responsive Composition

- Mobile: compact list with view details.
- Tablet: panel below or beside queue.
- Desktop: may show more history rows.

## Acceptance Criteria

- Completed and cancelled matches are visually distinct.
- Draw, unscored, and cancelled outcomes are visually and textually distinct.
- Result correction is not available to players.
- Correcting a result routes through rating recompute from the corrected match forward when ratings apply.
- Locally completed matches appear immediately before backend sync.
