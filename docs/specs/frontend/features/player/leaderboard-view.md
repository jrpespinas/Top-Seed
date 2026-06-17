# LeaderboardView

MVP v1 uses this as an **organizer-visible** leaderboard. Player-facing/public leaderboard access is future-version behavior.

Source of truth for stat semantics: `docs/specs/backend/match-results-and-ratings.md`.

## User Job

Show simple rankings and participation metrics so the organizer can answer “who’s winning tonight?” and “how are players doing at the club?” without making casual play feel overly competitive.

## Scope

Leaderboard data has two scopes in MVP v1:

| Scope | API | Meaning |
|-------|-----|---------|
| **Club** | `GET /api/v1/leaderboards/current` | Cumulative stats across all sessions in the organizer workspace |
| **Session** | `GET /api/v1/sessions/:sessionId/leaderboard` | Stats for completed matches in one session only |

Rules:

- **Club** is the default when opening `/organizer/leaderboard` without a session context.
- **Session** is the default when opening from a live session (dashboard shortcut or `/organizer/leaderboard?sessionId=:id`).
- Show a scope control (`Tabs` or segmented control): **Club** | **This session** (session tab only when `sessionId` is known).
- Label the active scope in the header, e.g. `Club leaderboard` or `Tonight — Open Play 9 Jun`.

Offline:

- Render from cached local match history for the active scope.
- Show `OfflineBanner` or inline note when values may be pending sync.

## Metrics

Each row uses `LeaderboardEntryDto` from `docs/specs/backend/api-contracts.md`.

| Field | UI label | Rules |
|-------|----------|-------|
| `displayName` | Player | Link/tap opens `PlayerDetailDrawer` |
| `wins`, `losses`, `draws` | **W-L-D** | Always show together as `3-1-0`; primary competitive record |
| `winRate` | Win % | `wins / (wins + losses + draws)`; show `-` when denominator is 0 |
| `matchesPlayed` | Games | Includes wins, losses, draws, and **unscored**; excludes **cancelled** |
| `currentRating` | Rating | Club skill rating (`defaultSkillRating`); label **Club rating**, not official Elo |
| `attendanceCount` | Sessions | Check-ins across club scope; session check-in for session scope |
| `rank` | # | Derived from active sort; not stored |

Outcome semantics (do not re-derive in UI):

- **Win / loss** — from `team_one_win` / `team_two_win`.
- **Draw** — all four participants get +1 draw; not a win for either side.
- **Unscored** — +1 `matchesPlayed` and attendance; no win, loss, draw, or win-rate effect.
- **Cancelled** — excluded from all leaderboard fields.

Session scope notes:

- `attendanceCount` in session scope is `1` if the player checked in to that session, else omit row or show `0` (prefer: only list players with a check-in for that session).
- `currentRating` remains the club rating in both scopes (not a separate session rating).

## Default Sort

| Scope | Default sort | Tie-breakers |
|-------|--------------|--------------|
| Session | Wins (desc) | Win rate → rating → matches played |
| Club | Rating (desc) | Wins → win rate → matches played |

## Supported Sorts

Expose all sorts in a `Select` or column headers:

- Rating
- Wins
- Losses
- Draws
- Games (`matchesPlayed`)
- Win %
- Sessions (`attendanceCount`)

Rules:

- Win % sort treats `-` (no decided matches) as lowest rank.
- Sort label copy must match field meaning (`Games`, not `Matches` if that is clearer courtside).

## Data Required

- `scope`: `club` | `session`
- `sessionId` when scope is `session`
- `sessionName` when scope is `session` (for header)
- Ordered `LeaderboardEntryDto` rows for active scope and sort
- Active `sort` and `sortDirection`
- Sync / offline freshness state
- Visibility flags for guest or hidden players (future public use; organizer MVP may show all)

## Child Components

- `PlayerDetailDrawer`
- `PlayerRow` or table rows
- `Tabs` (scope)
- `Select` (sort)
- `EmptyState`
- `StatusBadge`
- `OfflineBanner`
- `SyncStatusBadge`

## Actions Emitted

- `onChangeScope` — `{ scope: 'club' | 'session', sessionId? }`
- `onChangeSort` — `{ sort, direction }`
- `onViewPlayer` — opens `PlayerDetailDrawer` with session context when `sessionId` is known

## Permissions

MVP v1: organizer-only; no visibility filtering beyond future-proof flags.

Future: public or player-visible leaderboard must hide players per visibility settings.

## States

- Loading leaderboard.
- Empty leaderboard (no check-ins or no completed matches in scope).
- Leaderboard ready.
- Scope or sort changed.
- Offline cached leaderboard.
- Pending sync may affect freshness.
- **Stats updating** banner when a result correction is in flight or local recompute pending.
- Error.

## Freshness After Corrections

When a match result is corrected in the active session:

- Show a dismissible or auto-clearing banner: `Stats may be updating after a result change`.
- Refresh rows when local leaderboard snapshot updates.
- Club-scope leaderboard may lag if cross-session recompute is deferred; use `Session stats updated` vs `Club stats updating` when scopes differ.

See `docs/specs/backend/match-results-and-ratings.md` § Correction freshness UX.

## Responsive Composition

### Mobile

- Card-style rows; no wide horizontal table.
- Each card: player name, **W-L-D**, win %, games, rating on second line.
- Scope and sort in sticky header or top bar.

### Tablet and desktop

- Table-like layout is acceptable.
- Recommended columns: `#`, Player, W-L-D, Win %, Games, Rating, Sessions.
- Session scope may hide **Sessions** column (always 1 or redundant).

## Copy Guidelines

- Rating: **Club rating** — internal club skill, not official Elo.
- Win % with no decided matches: `-` or `No decided games`.
- Scope labels: **Club** and **This session** (not “Global” / “All time” unless user research prefers).
- Optional footnote: `Unscored games count in Games but not Win %.`

## Acceptance Criteria

- Every row shows **W-L-D**; losses and draws are never omitted.
- Win % follows `wins / (wins + losses + draws)` per `match-results-and-ratings.md`.
- Cancelled matches do not affect any displayed stat.
- Unscored matches increase **Games** only.
- Club and session scopes are both available when `sessionId` is present; session is default from dashboard entry.
- Club scope is default from global navigation.
- Sort includes wins, losses, draws, games, win %, rating, and attendance.
- Ratings are labeled as internal club ratings.
- Mobile layout does not require horizontal table scrolling.
- Cached leaderboard remains viewable offline with clear freshness/sync state.
- Tapping a player opens `PlayerDetailDrawer`.
