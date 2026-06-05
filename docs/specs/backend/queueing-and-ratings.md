# Queueing And Ratings Spec

## Product Goal

The queueing system should help a badminton organizer create fair doubles matches while keeping courts active and reducing arguments about whose turn is next. It should suggest matches, not fully automate the session without organizer control.

Queueing must work from locally cached session state while offline. The organizer should still be able to generate suggestions, accept a match, and continue play during a temporary disconnection.

## MVP Queue Inputs

Use these inputs for match suggestions:

- Checked-in players with `queueStatus` of `waiting`.
- Recently completed players with `queueStatus` of `resting`, if the waiting pool is too small.
- Player `sessionSkillRating`.
- Arrival order and time since last match.
- Recent partners and opponents within the same session.
- Court availability.

Exclude players when:

- They are unpaid and the session requires payment before play.
- They are already assigned or playing.
- They are marked `done` or `removed`.
- Organizer has temporarily paused their queue participation.

## MVP Match Format

Default format:

- Badminton doubles.
- Four players per match.
- Two teams of two.
- Organizer can manually assign singles or uneven games later, but auto-suggestion should optimize for doubles only.

## Suggestion Scoring

Generate candidate groups of four waiting players, then evaluate possible team pairings.

Candidate score should consider:

- `waitPriority`: higher when players have waited longer or played fewer matches.
- `teamBalance`: higher when team average ratings are close.
- `repeatPenalty`: lower when players recently had the same partner or opponents.
- `restPenalty`: lower when players just finished a match.
- `arrivalFairness`: higher when early arrivals are not skipped repeatedly.

Suggested score formula:

```text
score =
  waitPriority
  + teamBalance
  + arrivalFairness
  - repeatPenalty
  - restPenalty
```

The exact weights can change, but they must remain centralized and tested.

## Determinism

For the same session state, queue suggestions must be stable. Tie-breakers should use:

1. Longest waiting time.
2. Fewest matches played in the session.
3. Earliest arrival order.
4. Lowest player ID lexical order as final deterministic fallback.

Do not use random selection unless the organizer explicitly taps a shuffle action.

## Offline Queueing

MVP queueing runs locally from the browser's current session snapshot.

Rules:

- Suggestions must be generated from local check-ins, court state, match state, payment state, and recent match history.
- Accepting a suggestion creates a local pending sync action, such as `ACCEPT_SUGGESTION` or `CREATE_MATCH`.
- Manual assignments and accepted suggestions should sync as ordinary match assignment actions.
- The backend does not need to persist rejected suggestions in MVP.
- Deterministic tie-breakers must produce the same suggestion before and after sync when the underlying state is unchanged.
- If sync later rejects an assignment due to an impossible state, the UI must show a recoverable sync error and keep local history visible for organizer review.

## Organizer Controls

The organizer must be able to:

- Accept the top suggestion.
- Regenerate suggestions.
- Swap a player.
- Swap team pairings.
- Manually create a match.
- Skip a player with a note.
- Mark a player as resting, done, or removed.

Manual assignments should still be recorded as normal matches.

## Rating Model

Use a simple internal rating for MVP:

- Scale: `1.0` to `5.0`.
- Default: `3.0`.
- Precision: one decimal place for display, more precision allowed internally.
- Source of truth: `PlayerProfile.defaultSkillRating`.
- Session override: `CheckIn.sessionSkillRating`.

## Rating Updates

After a completed match with a winner:

- Compute each team's average rating.
- Estimate whether the winning team was favored or underdog.
- Apply a small delta to winners and losers.
- Cap per-match movement to avoid overreacting to casual games.

Suggested MVP deltas:

- Even match win: winners `+0.05`, losers `-0.05`.
- Underdog win: winners up to `+0.10`, losers down to `-0.10`.
- Favored win: winners `+0.02`, losers `-0.02`.
- No rating change for cancelled matches or unscored practice games.

Clamp final ratings between `1.0` and `5.0`.

## Leaderboard Inputs

MVP leaderboard can expose:

- Current rating.
- Matches played.
- Wins.
- Win rate.
- Attendance count.

Avoid presenting the rating as official Elo until the rating algorithm is more mature and clearly explained.

## Test Scenarios

Queueing tests should cover:

- Four waiting players produce one doubles suggestion.
- More than four waiting players prioritize longer waiting players.
- Team balance avoids stacking the two highest-rated players together when alternatives exist.
- Recently partnered players receive a repeat penalty.
- Players in active matches are excluded.
- Manual assignment respects court and player availability constraints.

Rating tests should cover:

- Even-team win changes ratings slightly.
- Underdog win changes ratings more than favored win.
- Cancelled match does not change ratings.
- Ratings are clamped to the allowed range.
