# Leaderboard Page

## Route

- `/leaderboard`
- `/organizer/leaderboard` if organizer-prefixed routes are preferred.
- `/session/:sessionId/leaderboard` is future player/public behavior.

## Primary User

- Organizer.

## User Goal

View simple club or session rankings and participation metrics for organizer review.

When offline, show the latest cached leaderboard derived from local session history.

## Entry Points

- Organizer dashboard if linked.
- Organizer navigation.

## Data Dependencies

- Current leaderboard rows.
- Sort mode.
- Optional session scope.
- Cached local leaderboard calculation and sync status.

## Component Composition

- `LeaderboardView`
- `Tabs`
- `PlayerRow`
- `EmptyState`
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading leaderboard.
- Empty leaderboard.
- Leaderboard ready.
- Sort changed.
- Error.
- Offline cached leaderboard.
- Pending sync may affect leaderboard freshness.

## Primary Actions

- Change leaderboard sort.
- View organizer-managed player summary when available.

## Secondary Actions

- Return to dashboard or sessions.

## Responsive Layout

- Mobile: ranking cards or compact rows.
- Tablet and desktop: table-like layout is acceptable if responsive.

## Navigation

- Player row can link to organizer-managed player detail when available.
- Back navigation returns to source page.

## API Endpoints

- `GET /api/leaderboards/current`
- `GET /api/sessions/:sessionId/leaderboard`

## Acceptance Criteria

- Ratings are not labeled official Elo.
- Public/player visibility is deferred.
- Mobile layout does not require horizontal table scrolling.
- Cached leaderboard remains viewable offline and clearly indicates if it may be pending sync.
