# PlayerMatchHistory

Future version spec. Do not implement this player-owned component in MVP v1. MVP v1 supports organizer-visible match history.

## User Job

Let a player review past badminton matches and outcomes.

## Data Required

- Match date.
- Session name.
- Partner and opponents.
- Result.
- Score.
- Rating change if visible.

## Child Components

- `MatchCard`
- `EmptyState`
- `Tabs` or filters when history grows.

## Actions Emitted

- `onViewMatch`
- `onFilterHistory`

## Permissions

- Player can view their own history.
- Public history visibility must respect player privacy settings when added.

## States

- Loading history.
- No history.
- History ready.
- Filtered empty state.
- Error.

## Responsive Composition

- Mobile: compact vertical list.
- Tablet and desktop: list can sit beside profile summary.

## Acceptance Criteria

- Uses plain result labels: `Won`, `Lost`, `Cancelled`, `Unscored`.
- Does not expose organizer notes.
- Scores and dates use shared formatters.
