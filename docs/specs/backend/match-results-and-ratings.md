# Match Results And Ratings Spec

## Purpose

Define match outcome semantics, rating effects, leaderboard effects, and result correction behavior for MVP v1.

This file is the source of truth for:

- `team_one_win`
- `team_two_win`
- `draw`
- `unscored`
- `cancelled`
- result correction
- session rating mode

## Session Rating Mode

Each session has a `ratingMode`.

Allowed values:

- `casual`: record match history and leaderboard stats without changing player ratings.
- `rated`: record match history, leaderboard stats, and rating changes.

MVP default:

- `ratingMode`: `casual`.

Rules:

- The organizer chooses rating mode during session setup.
- Rating mode can be shown as `Casual` or `Rated`.
- Casual sessions still track wins, losses, draws, unscored matches, match count, and attendance.
- Rated sessions update `PlayerProfile.defaultSkillRating`, `MatchParticipant` rating fields, and `RatingHistory`.
- Future tournament or league modes should build on `ratingMode`; do not add tournament-specific result logic to MVP.

## Match Outcomes

### `team_one_win`

Meaning:

- Team one won the match.

Effects:

- Count one win for team one participants.
- Count one loss for team two participants.
- Count as a decided match.
- Include in win-rate denominator.
- In rated sessions, update ratings.

### `team_two_win`

Meaning:

- Team two won the match.

Effects:

- Count one win for team two participants.
- Count one loss for team one participants.
- Count as a decided match.
- Include in win-rate denominator.
- In rated sessions, update ratings.

### `draw`

Meaning:

- The teams finished level under the organizer's scoring rule, such as timed play or agreed draw.

Effects:

- Count one draw for all participants.
- Do not count as a win for either side.
- Count as match played.
- Include in win-rate denominator.
- In rated sessions, apply a small expectation-based rating change.

Rating rule:

- If teams were evenly rated, draw rating change should be near zero.
- If a lower-rated team draws a higher-rated team, the lower-rated team should gain slightly and the higher-rated team should lose slightly.
- Draw rating movement should be capped lower than win/loss movement.

Suggested MVP cap:

- Maximum per-player draw movement: `0.03`.

### `unscored`

Meaning:

- The match was completed or recorded without a winner, draw, or reliable score.

Effects:

- Count as match played.
- Count toward attendance.
- Do not count as win, loss, or draw.
- Exclude from win-rate denominator.
- Do not update ratings, even in rated sessions.

Use cases:

- Practice game.
- Incomplete score reporting.
- Organizer chooses to close the match without a competitive result.

### `cancelled`

Meaning:

- The match assignment was cancelled and should remain visible for organizer audit/history.

Effects:

- Keep visible in organizer history.
- Do not count as match played.
- Do not count toward win, loss, draw, or win rate.
- Do not update ratings.
- Do not affect leaderboard stats.

Rules:

- Cancelled matches should be visually distinct from completed matches.
- Cancellation releases the court to `open` and returns all participants to `waiting`. See `docs/specs/backend/state-transitions.md`.

## Win Rate

MVP win rate formula:

```text
winRate = wins / (wins + losses + draws)
```

Rules:

- Draws are included in the denominator.
- Unscored matches are excluded from the denominator.
- Cancelled matches are excluded from the denominator.
- If denominator is zero, display win rate as `-` or `No decided matches`.
- Always show `W-L-D` record near win rate when space allows.

## Rating Updates

Rating updates apply only when:

- `Session.ratingMode` is `rated`.
- Match status becomes `completed`.
- Outcome is `team_one_win`, `team_two_win`, or `draw`.

Rating updates do not apply when:

- Session rating mode is `casual`.
- Outcome is `unscored`.
- Match status is `cancelled`.

Rated completion effects:

- Compute rating deltas from participant `ratingBefore` values.
- Write `ratingAfter` and `ratingDelta` to `MatchParticipant`.
- Append `RatingHistory` for each participant.
- Update each player's `PlayerProfile.defaultSkillRating`.
- Keep enough history to recompute later corrections.

Suggested win/loss MVP deltas:

- Even match win: winners `+0.05`, losers `-0.05`.
- Underdog win: winners up to `+0.10`, losers down to `-0.10`.
- Favored win: winners `+0.02`, losers `-0.02`.

Suggested draw MVP deltas:

- Even-team draw: near `0.00`.
- Lower-rated team draw: lower-rated players gain up to `+0.03`.
- Higher-rated team draw: higher-rated players lose up to `-0.03`.

Clamp final ratings between `1.0` and `5.0`.

## Result Recording

`COMPLETE_MATCH` records the final result and applies side effects.

Rules:

- Completion payload must include outcome.
- `winningTeam` is required for `team_one_win` and `team_two_win`.
- `winningTeam` must be empty for `draw` and `unscored`.
- Scores are optional for `unscored`.
- Scores are recommended for wins and draws but MVP can allow winner-only completion.
- Completion must be idempotent under sync replay.
- Rating and leaderboard side effects must apply exactly once.
- Player queue side effects: release court, return participants to `waiting` (or `assigned` if still staged elsewhere). See `docs/specs/backend/state-transitions.md`.

`UPDATE_MATCH_RESULT` is correction-only after completion.

Rules:

- Do not use `UPDATE_MATCH_RESULT` for draft score entry before completion in MVP.
- Corrections should be organizer-only.
- Corrections should enqueue a sync action when offline.

## Result Correction

Correction strategy:

- Recompute affected players from the corrected match forward within the session.

Rules:

- Store the corrected outcome and scores.
- Recalculate rating history for all affected participants from that match forward in chronological order.
- Update affected `MatchParticipant.ratingBefore`, `ratingAfter`, and `ratingDelta`.
- Update affected `PlayerProfile.defaultSkillRating` to the final recomputed value.
- Preserve an audit trail that a correction happened.
- Correction must be idempotent under sync replay.

MVP limitation:

- Cross-session rating recompute can be deferred if historical sessions are not yet deeply linked.
- If cross-session recompute is deferred, surface that ratings are recomputed within the current session scope.

### Correction freshness UX

When `UPDATE_MATCH_RESULT` changes outcomes or ratings:

| Surface | Behavior |
|---------|----------|
| `RecentMatchesPanel` | Show inline callout on corrected row: `Result updated — stats refreshing` until server/local recompute completes |
| `LeaderboardView` | Show `Stats may be updating` banner when a correction sync is pending or `sideEffects.leaderboardRecomputed` not yet applied locally |
| `PlayerDetailDrawer` | Club rating and session W-L-D show `SyncStatusBadge` or short note if stale after correction |
| Match detail / `MatchCard` | `Corrected` label with timestamp when correction metadata exists |

Rules:

- Do not silently show old win/loss counts after a successful correction payload is applied locally.
- If recompute is session-scoped only, say so in UI copy: `Ratings updated for tonight's session`.
- Ended sessions: corrections may be read-only per session mode; history still shows `Corrected` badge when supported.

Frontend specs: `recent-matches-panel.md`, `leaderboard-view.md`.

## Leaderboard Effects

Leaderboard should track per scope (club or session):

- Matches played: completed matches with outcomes `team_one_win`, `team_two_win`, `draw`, or `unscored`.
- Wins.
- Losses.
- Draws.
- Win rate: `wins / (wins + losses + draws)`; null when denominator is zero.
- Attendance count.
- Current rating (club `defaultSkillRating`; not recomputed per session).

Rules:

- Cancelled matches do not affect leaderboard stats.
- Unscored matches count as matches played but not win-rate denominator.
- Draws count separately and are included in win-rate denominator.
- Current rating comes from `PlayerProfile.defaultSkillRating`.
- Casual sessions update stats without changing current rating.
- Frontend scope and display: `docs/specs/frontend/features/player/leaderboard-view.md`.

## Testing Expectations

Tests should cover:

- Win/loss completion updates stats and rated-session ratings.
- Draw does not count as a win for either team.
- Rated draw gives a small expectation-based rating change.
- Casual draw records stats but does not change ratings.
- Unscored completion counts match played and attendance but does not affect rating or win rate.
- Cancelled match remains in history but has no stat or rating effects.
- Completion side effects are idempotent under sync replay.
- Correcting a result recomputes affected players from the corrected match forward.
- Win rate uses `wins / (wins + losses + draws)`.
