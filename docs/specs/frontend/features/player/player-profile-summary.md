# PlayerProfileSummary

Future version spec for player-owned profile surfaces. MVP v1 may show organizer-managed player summaries, but player account/profile ownership is deferred.

## User Job

Summarize a player's basic badminton identity and stats.

## Data Required

- Display name.
- Current rating.
- Matches played.
- Wins.
- Recent form.
- Attendance count.

## Child Components

- `Card`
- `MetricCard`
- `StatusBadge`

## Actions Emitted

- `onEditProfile` when account editing exists.
- `onViewHistory`

## Permissions

- Player can view own summary.
- Organizer notes are never player-visible.

## States

- Loading profile.
- Profile ready.
- Partial guest profile.
- Error.

## Responsive Composition

- Mobile: compact summary above history.
- Tablet and desktop: can sit beside match history and leaderboard context.

## Acceptance Criteria

- Rating is clearly labeled as internal.
- Missing optional stats do not break layout.
- No organizer-only notes are displayed.
