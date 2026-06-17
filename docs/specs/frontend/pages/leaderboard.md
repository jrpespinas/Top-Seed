# Leaderboard Page

## Route

- `/organizer/leaderboard` — club scope default.
- `/organizer/leaderboard?sessionId=:sessionId` — session scope default (from dashboard shortcut).
- `/leaderboard` — alias to organizer leaderboard in MVP v1.
- `/session/:sessionId/leaderboard` — future player/public behavior; do not implement in MVP v1.

## Primary User

- Organizer.

## User Goal

View club-wide or tonight’s session rankings with full W-L-D records, win rate, games played, and club rating.

When offline, show the latest cached leaderboard for the active scope derived from local match history.

## Entry Points

| Entry | Default scope | URL |
|-------|---------------|-----|
| Organizer navigation | Club | `/organizer/leaderboard` |
| Session dashboard shortcut | Session | `/organizer/leaderboard?sessionId=:sessionId` |
| `PlayerDetailDrawer` / history (future) | Club or session | context-dependent |

## Data Dependencies

- `LeaderboardEntryDto` rows for active scope.
- `scope`: `club` | `session`.
- `sessionId` and `sessionName` when in session scope.
- Sort mode and direction.
- Cached local leaderboard calculation and sync status.

Stat rules: `docs/specs/backend/match-results-and-ratings.md`.  
UI rules: `docs/specs/frontend/features/player/leaderboard-view.md`.

## Component Composition

- `LeaderboardView`
- `PlayerDetailDrawer` (overlay)
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading leaderboard.
- Empty leaderboard.
- Leaderboard ready.
- Scope or sort changed.
- Offline cached leaderboard.
- Pending sync may affect leaderboard freshness.
- Error.

## Primary Actions

- Switch scope: **Club** | **This session** (session tab when `sessionId` is available).
- Change sort.
- View player via `PlayerDetailDrawer`.

## Secondary Actions

- Return to dashboard or sessions.

## Responsive Layout

- Mobile: ranking cards per `leaderboard-view.md`.
- Tablet and desktop: responsive table per `leaderboard-view.md`.

## Navigation

- Dashboard shortcut preserves `sessionId` query so **This session** opens first.
- Global nav opens **Club** first.
- Back navigation returns to source page.

## API Endpoints

| Scope | Endpoint |
|-------|----------|
| Club | `GET /api/v1/leaderboards/current` |
| Session | `GET /api/v1/sessions/:sessionId/leaderboard` |

Query params (optional, both endpoints):

- `sort`: `rating` | `wins` | `losses` | `draws` | `matchesPlayed` | `winRate` | `attendance`
- `direction`: `asc` | `desc`

## Dashboard Preview

The session dashboard may show a compact **leaderboard preview** (not the full page):

- Session scope only.
- Top 5 rows by wins (default).
- Columns: rank, player, W-L-D, win %.
- Link: `View all` → `/organizer/leaderboard?sessionId=:sessionId`.

Shape: array of `LeaderboardEntryDto` in dashboard snapshot `leaderboardPreview`. See `docs/specs/backend/api-contracts.md`.

## Acceptance Criteria

- Club and session scopes are documented and reachable from the UI.
- Full W-L-D, win %, games, rating, and attendance follow backend semantics.
- Win % uses `-` when there are no decided games.
- Ratings are not labeled official Elo.
- Public/player visibility is deferred.
- Mobile layout does not require horizontal table scrolling.
- Cached leaderboard remains viewable offline and indicates pending sync when relevant.
