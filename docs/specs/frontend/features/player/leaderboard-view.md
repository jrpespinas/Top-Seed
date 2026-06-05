# LeaderboardView

MVP v1 uses this as an organizer-visible leaderboard view. Player-facing/public leaderboard access is future-version behavior.

## User Job

Show simple rankings and participation metrics without making casual play feel overly competitive.

## Data Required

- Player rank rows.
- Rating.
- Wins.
- Matches played.
- Win rate.
- Attendance count.
- Visibility flags for guest or hidden players.

## Child Components

- `PlayerRow`
- `Tabs`
- `EmptyState`
- `StatusBadge`

## Actions Emitted

- `onChangeSort`
- `onViewPlayer`

## Permissions

- Public or player-visible leaderboard must hide players according to visibility settings.
- Organizer may see fuller detail when implemented.

## States

- Loading leaderboard.
- Empty leaderboard.
- Leaderboard ready.
- Sort changed.
- Error.

## Responsive Composition

- Mobile: card-style rows, no wide table.
- Tablet and desktop: table-like layout is acceptable if responsive.

## Acceptance Criteria

- Ratings are labeled as internal club ratings, not official Elo.
- Guest-only players are hidden unless visibility is enabled.
- Sort labels are clear.
