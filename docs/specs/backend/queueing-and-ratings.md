# Queueing And Ratings Spec

## Product Goal

The queueing system should help a badminton organizer create fair doubles matches while keeping courts active and reducing arguments about whose turn is next. It should suggest matches, not fully automate the session without organizer control.

Queueing must work from locally cached session state while offline. The organizer should still be able to generate suggestions, stage matches in queue lanes, accept a match, and continue play during a temporary disconnection.

Match assignment rules are in **Match Assignment Pipeline** below. State side effects: `docs/specs/backend/state-transitions.md`.

## Match Assignment Pipeline

MVP uses a **staging-first** pegboard flow. The organizer sees who is `Next` before anyone lands on a court.

### Default flow (normal operation)

```text
Suggest / Accept / Manual build
        ↓
   Next lane (queued match: draft → ready)
        ↓
   Organizer selects court → Send to court
        ↓
   Court roster (match assigned) → Start → Finish
```

Rules:

- **Accept suggestion** creates a `CREATE_QUEUED_MATCH` in the selected Next lane. It does not assign a court.
- **Manual build** in a lane uses the same staging path.
- **Send to court** (`MOVE_QUEUED_MATCH_TO_COURT`) is the normal way players move from `Next` to `Now`.
- Accept suggestion must not skip staging in the default flow.
- When multiple courts are open, the organizer must choose the target court before promotion.

UI copy for default actions:

- Prefer **Add to Next queue** or **Add to [lane name]** over **Assign to court** for suggestions.
- Prefer **Send to court** for promotion from a ready queued match.

### Override flow (intentional shortcut)

Direct-to-court skips Next staging when the organizer explicitly chooses it.

Allowed triggers:

- Drag four players from Available onto an empty court.
- Tap **Assign directly to [court]** from a player or court menu.

Rules:

- Direct assignment uses `CREATE_MATCH` (or `POST /api/v1/sessions/:sessionId/matches`).
- Show confirmation copy such as **Assigned directly — skipped Next queue**.
- Do not use direct assignment as the default for accept suggestion.

### API and sync mapping

| Organizer intent | Primary path | Sync action |
|------------------|--------------|-------------|
| Accept suggestion | Add to selected Next lane | `CREATE_QUEUED_MATCH` |
| Send ready match to court | Promote staged match | `MOVE_QUEUED_MATCH_TO_COURT` |
| Direct to court (override) | Skip Next | `CREATE_MATCH` |

`POST /api/v1/sessions/:sessionId/queue/manual-assignment` is a legacy alias for **direct court assignment** only. New implementations should prefer `POST /api/v1/sessions/:sessionId/matches`. Do not use `manual-assignment` for accept suggestion or lane staging.

## MVP Queue Inputs

Use these inputs for match suggestions:

- Checked-in players with `queueStatus` of `waiting`.
- Checked-in players with `queueStatus` of `resting`, only when the waiting pool is too small to form a doubles match.
- Player `sessionSkillRating`.
- Arrival order and time since last match.
- Recent partners and opponents within the same session.
- Court availability.

Players who just completed a match return to `waiting` immediately and are eligible for suggestions without organizer confirmation. See `docs/specs/backend/state-transitions.md`.

Exclude players when:

- They are `playing` or on an active court match (`assigned` on court).
- They are marked `done` or `removed`.
- Organizer has temporarily paused their queue participation (`suggestionExcluded` on check-in).

Do not exclude players solely for `unpaid` or `partial` payment status in MVP v1. Payment is tracked for organizer visibility only. See `docs/specs/backend/payments.md`.

Do not exclude players solely because they are staged in one or more queue lanes. Multi-lane staging is allowed for future matchup planning.

## Queue Mode

Each session has `queueMode`.

| Value | Organizer experience | Suggestion engine |
|-------|---------------------|-------------------|
| `suggested` | Global **Suggested next match** strip on `NextQueuePanel` | On |
| `manual` | No suggestion strip; build in Next lanes or direct assign | Off |

Rules:

- Default: `suggested`.
- `manual` does not disable queue lanes, manual staging, or send-to-court.
- Session setup exposes queue mode as **Suggested matches** (on) vs **Manual queue only** (off). See `organizer-session-new.md`.

## Skip Player From Suggestions

Organizer can temporarily exclude a waiting player from auto-suggestions while keeping them checked in.

Behavior:

- Set `suggestionExcluded: true` on the check-in via `UPDATE_CHECK_IN`.
- Optional `suggestionExcludeNote` (organizer-visible plain text).
- Player stays `waiting` unless queue status changes separately.
- Excluded players are omitted from suggestion pools but may still be manually staged or direct-assigned.
- **Clear skip** sets `suggestionExcluded: false`.

UI: `QueuePanel` → **Skip suggestions** / **Clear skip**. Spec: `queue-panel.md`.

Different from `resting`, `done`, `removed`, or unpaid status (MVP does not gate on payment).

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

- Suggestions must be generated from local check-ins, queue lanes, queued matches, court state, match state, payment state, and recent match history.
- Accepting a suggestion creates `CREATE_QUEUED_MATCH` in the selected Next lane per the Match Assignment Pipeline. Do not create `CREATE_MATCH` on accept.
- Direct court assignment uses `CREATE_MATCH` only through the labeled override flow.
- The backend does not need to persist rejected suggestions in MVP.
- Deterministic tie-breakers must produce the same suggestion before and after sync when the underlying state is unchanged.
- If sync later rejects an assignment due to an impossible state, the UI must show a recoverable sync error and keep local history visible for organizer review.

## Queue Lanes

MVP queue lanes are generic organizer-created staging lanes for upcoming matches.

Rules:

- Start each active session with one default queue lane.
- Allow the organizer to add, rename, reorder, and delete queue lanes.
- Require confirmation before deleting a queue lane.
- If a deleted lane contains queued matches, remove those queued matches as part of the confirmed deletion.
- Do not delete or modify matches already assigned to courts when deleting a queue lane.
- Prevent deleting the final active queue lane in an active session.
- Allow queued matches to move between lanes.
- Allow a complete queued match from any lane to be moved to any available court.
- When multiple courts are open, require the organizer to choose the target court.
- Accept suggestion targets the selected lane; manual lane and court selection remain visible.

## Organizer Controls

The organizer must be able to:

- Accept the top suggestion.
- Add, rename, reorder, and delete queue lanes.
- Add a queued match to a chosen lane.
- Move a queued match between lanes.
- Move a queued match from a lane to a chosen court.
- Regenerate suggestions.
- Swap a player.
- Swap team pairings.
- Manually create a match.
- Skip a player from suggestions with an optional note (`suggestionExcluded`, `suggestionExcludeNote`).
- Mark a player as resting, done, or removed.

Manual assignments should still be recorded as normal matches.

## Rating Model

Use a simple internal rating for MVP:

- Scale: `1.0` to `5.0`.
- Default: `3.0`.
- Precision: one decimal place for display, more precision allowed internally.
- Source of truth: `PlayerProfile.defaultSkillRating`.
- Session override: `CheckIn.sessionSkillRating`.

Session rating behavior is controlled by `Session.ratingMode`:

- `casual`: record match stats and history without changing ratings.
- `rated`: record match stats, rating history, match participant deltas, and update `PlayerProfile.defaultSkillRating`.

Match outcome semantics and correction rules are defined in `docs/specs/backend/match-results-and-ratings.md`.

## Rating Updates

After a completed rated match with a winner:

- Compute each team's average rating.
- Estimate whether the winning team was favored or underdog.
- Apply a small delta to winners and losers.
- Cap per-match movement to avoid overreacting to casual games.

Suggested MVP deltas:

- Even match win: winners `+0.05`, losers `-0.05`.
- Underdog win: winners up to `+0.10`, losers down to `-0.10`.
- Favored win: winners `+0.02`, losers `-0.02`.
- Draw: lower-rated team can gain up to `+0.03`, higher-rated team can lose up to `-0.03`, and even-team draw should be near `0.00`.
- No rating change for casual sessions, cancelled matches, or unscored practice games.

Clamp final ratings between `1.0` and `5.0`.

## Leaderboard Inputs

MVP leaderboard can expose:

- Current rating.
- Matches played.
- Wins.
- Losses.
- Draws.
- Win rate.
- Attendance count.

Win rate should follow `wins / (wins + losses + draws)`. Unscored and cancelled matches are excluded from the denominator.

Avoid presenting the rating as official Elo until the rating algorithm is more mature and clearly explained.

## Test Scenarios

Queueing tests should cover:

- Four waiting players produce one doubles suggestion.
- More than four waiting players prioritize longer waiting players.
- Team balance avoids stacking the two highest-rated players together when alternatives exist.
- Recently partnered players receive a repeat penalty.
- Players in active court matches are excluded.
- Players staged in queue lanes remain eligible for suggestions into other lanes unless excluded by `done`, `removed`, or active court assignment.
- Queue lane deletion removes queued matches in that lane after confirmation.
- Queue lane deletion does not remove assigned, active, completed, or cancelled court matches.
- The final active queue lane cannot be deleted during an active session.
- A queued match can move between lanes.
- A complete queued match can be promoted from any lane to a selected open court.
- Promoting a queued match removes duplicate staged slots for those players in other lanes.
- The same player may be staged in multiple queue lanes before promotion.
- Manual assignment respects court and player availability constraints.
- Accept suggestion stages in Next lane only; direct court assignment shows skipped-queue messaging.
- `suggestionExcluded` check-ins are omitted from suggestion pools but can be manually staged.
- `queueMode: manual` omits suggestion preview; lanes and manual staging still work.

Rating tests should cover:

- Even-team win changes ratings slightly.
- Underdog win changes ratings more than favored win.
- Draw does not count as a win and applies small expectation-based rating changes only in rated sessions.
- Unscored completion does not change ratings.
- Cancelled match does not change ratings.
- Casual session results do not change ratings.
- Ratings are clamped to the allowed range.
