# Backend API Spec

## API Principles

- Use resource-oriented endpoints.
- Keep organizer workflows fast: most live dashboard actions should take one request.
- MVP v1 endpoints are organizer-operated without login.
- Keep authorization boundaries explicit in code structure so login can be added later.
- Return normalized IDs and enough denormalized display data for dashboard rendering.
- Prefer idempotent operations where double taps are likely.
- Mutating operations must support client-generated action IDs or idempotency keys because offline actions may be replayed after reconnecting.
- Batch sync should return per-action success or failure so the organizer can recover from specific sync errors.
- Controllers or route handlers should stay thin and delegate mutating work to application use cases defined by `docs/specs/backend/backend-architecture.md`.
- API schema conventions, response envelopes, pagination, versioning, DTO rules, and security baseline are defined in `docs/specs/backend/api-contracts.md`.
- All MVP endpoints should use the `/api/v1` prefix.

## Resource Groups

### Sync

Purpose: accept locally queued organizer actions and reconcile them with server state after disconnection.

Canonical action names, payloads, ordering, idempotency, and response semantics are defined in `docs/specs/backend/sync-actions.md`.

Endpoints:

- `POST /api/v1/sync/actions`
- `GET /api/v1/sync/status`

`POST /api/v1/sync/actions` request shape:

```json
{
  "organizationId": "default-organization-id",
  "deviceId": "organizer-device",
  "actions": [
    {
      "id": "client-action-id",
      "type": "UPDATE_PAYMENT",
      "entityType": "checkIn",
      "entityId": "check-in-id",
      "sessionId": "session-id",
      "payload": {
        "paymentStatus": "paid",
        "paymentAmountPaid": 250,
        "paymentMethod": "cash",
        "paymentNotes": ""
      },
      "createdAt": "2026-06-06T00:00:00.000Z"
    }
  ]
}
```

`POST /api/v1/sync/actions` response shape:

```json
{
  "organizationId": "default-organization-id",
  "deviceId": "organizer-device",
  "processedAt": "2026-06-06T00:00:05.000Z",
  "results": [
    {
      "actionId": "client-action-id",
      "status": "applied",
      "entityType": "checkIn",
      "entityId": "check-in-id",
      "canonicalEntityId": "check-in-id",
      "serverVersion": 12,
      "serverUpdatedAt": "2026-06-06T00:00:05.000Z"
    }
  ]
}
```

`GET /api/v1/sync/status` response shape:

```json
{
  "organizationId": "default-organization-id",
  "deviceId": "organizer-device",
  "lastSyncedAt": "2026-06-06T00:00:05.000Z",
  "serverTime": "2026-06-06T00:01:00.000Z",
  "pendingCount": 0,
  "failedCount": 1,
  "failedActions": [
    {
      "actionId": "client-action-id",
      "type": "MOVE_QUEUED_MATCH_TO_COURT",
      "entityType": "queuedMatch",
      "entityId": "queued-match-id",
      "errorCode": "COURT_ALREADY_OCCUPIED",
      "message": "Court 1 already has an active match."
    }
  ]
}
```

Required behavior:

- Treat `actions[].id` as an idempotency key.
- Applying the same action twice must not duplicate effects.
- Return success or failure per action.
- Reject impossible state transitions with actionable error codes.
- Preserve original action order for actions from the same session unless explicitly independent.
- Stop dependent later actions after a failed dependency, but continue unrelated actions when safe.
- Acknowledge server timestamps and canonical IDs for locally created entities.
- Use `organizationId` for MVP sync scope; do not introduce a separate `workspaceId` concept.

### Organizations

Purpose: manage club, group, venue, or default organizer workspace data. In MVP v1 this may be a single local/default workspace.

Endpoints:

- `GET /api/v1/organizations/current`
- `PATCH /api/v1/organizations/current`

### Players

Purpose: maintain organizer-managed reusable player records.

Endpoints:

- `GET /api/v1/players`
- `POST /api/v1/players`
- `GET /api/v1/players/:playerId`
- `PATCH /api/v1/players/:playerId`
- `GET /api/v1/players/:playerId/history`

Required behavior:

- Search by display name and phone.
- Allow organizer-created player profiles without login accounts.
- Do not delete players with match history; mark them inactive.

### Sessions

Purpose: create and run badminton sessions.

Endpoints:

- `GET /api/v1/sessions`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `PATCH /api/v1/sessions/:sessionId`
- `GET /api/v1/sessions/:sessionId/dashboard`
- `POST /api/v1/sessions/:sessionId/open`
- `POST /api/v1/sessions/:sessionId/start`
- `POST /api/v1/sessions/:sessionId/complete`
- `POST /api/v1/sessions/:sessionId/cancel`

Required behavior:

- Only `draft` sessions can be opened.
- Only `open` sessions can become `active`.
- Completing a session is blocked while any court match is `assigned` or `in_progress`.
- On complete: set session `completed`, close open courts, mark `waiting` and `resting` check-ins as `done`, and freeze live dashboard actions. See `docs/specs/backend/state-transitions.md`.
- Dashboard snapshot response shape is defined in `docs/specs/backend/api-contracts.md`.

### Courts

Purpose: manage session courts.

Endpoints:

- `GET /api/v1/sessions/:sessionId/courts`
- `POST /api/v1/sessions/:sessionId/courts`
- `PATCH /api/v1/sessions/:sessionId/courts/:courtId`
- `DELETE /api/v1/sessions/:sessionId/courts/:courtId`
- `POST /api/v1/sessions/:sessionId/courts/:courtId/pause`
- `POST /api/v1/sessions/:sessionId/courts/:courtId/mark-unavailable`
- `POST /api/v1/sessions/:sessionId/courts/:courtId/reopen`

Required behavior:

- A court with an active match cannot be paused without cancelling or completing the match.
- A court with an active match cannot be deleted or marked unavailable without cancelling or completing the match.
- Deleting a court must not delete assigned, completed, or cancelled match history.

### Check-Ins

Purpose: track attendance, queue state, session rating, and payment status.

Endpoints:

- `GET /api/v1/sessions/:sessionId/check-ins`
- `POST /api/v1/sessions/:sessionId/check-ins`
- `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId`
- `POST /api/v1/sessions/:sessionId/check-ins/:checkInId/remove`
- `POST /api/v1/sessions/:sessionId/check-ins/:checkInId/restore`

Required behavior:

- Prevent duplicate active check-ins for the same player in a session.
- Assign `arrivalOrder` when the check-in is created.
- Allow organizer to override `sessionSkillRating` for the current session.
- Accept client-generated IDs or idempotency keys for offline-created check-ins.

### Payments

Purpose: manually track session payment state.

Endpoints:

- `GET /api/v1/sessions/:sessionId/payments`
- `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId/payment`

Required behavior:

- Payment updates must capture status, amount paid, amount due, method, notes, and updater.
- Allowed statuses: `unpaid`, `partial`, `paid`, `waived`, `refunded`.
- `refunded` is for cash returned outside the app after a prior payment; it affects collected totals.
- Payment status must not change global player records.
- Payment updates may arrive later through sync and must remain idempotent.

### Queue

Purpose: generate and manage next-match suggestions, queue lanes, and staged upcoming matches.

Endpoints:

- `GET /api/v1/sessions/:sessionId/queue`
- `POST /api/v1/sessions/:sessionId/queue/lanes`
- `PATCH /api/v1/sessions/:sessionId/queue/lanes/:laneId`
- `DELETE /api/v1/sessions/:sessionId/queue/lanes/:laneId`
- `POST /api/v1/sessions/:sessionId/queue/lanes/reorder`
- `POST /api/v1/sessions/:sessionId/queue/lanes/:laneId/queued-matches`
- `PATCH /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId`
- `DELETE /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId`
- `POST /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId/move-to-lane`
- `POST /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId/move-to-court`
- `POST /api/v1/sessions/:sessionId/queue/suggestions`
- `POST /api/v1/sessions/:sessionId/queue/manual-assignment` (legacy alias for direct court assignment; prefer `POST /matches`)

Required behavior:

- `GET /queue` returns queue lanes in `sortOrder`, with ordered queued matches per lane.
- A new active session should have at least one default queue lane.
- Queue lanes are generic MVP staging lanes and should not require skill labels or court binding.
- Deleting an empty lane requires confirmation.
- Deleting a non-empty lane requires confirmation and deletes queued matches still inside the lane.
- Deleting a lane must not affect matches already assigned to courts.
- The final active queue lane in an active session cannot be deleted.
- Queued matches can move between lanes.
- Moving a queued match to a court must require court selection when multiple courts are open.
- Moving a queued match to a court promotes it into the normal match creation path.
- Suggestions must be deterministic for the same input.
- Accepting a suggestion creates a queued match in a Next lane (`POST .../queue/lanes/:laneId/queued-matches` or sync `CREATE_QUEUED_MATCH`). It does not assign a court.
- Regenerate and manual lane edits use the queue lane and queued match endpoints.
- Direct court assignment uses `POST /api/v1/sessions/:sessionId/matches` (`CREATE_MATCH`) and is an intentional skip of Next staging.
- `manual-assignment` must not be used for accept suggestion or lane staging in new implementations.
- Offline-generated suggestions sync as `CREATE_QUEUED_MATCH`, not opaque algorithm state.
- Lane and queued match mutations must accept client-generated IDs or idempotency keys for offline replay.

### Matches

Purpose: assign courts, record results, and update history.

Outcome semantics, rating side effects, leaderboard effects, and correction behavior are defined in `docs/specs/backend/match-results-and-ratings.md`.

Endpoints:

- `GET /api/v1/sessions/:sessionId/matches`
- `POST /api/v1/sessions/:sessionId/matches`
- `POST /api/v1/sessions/:sessionId/matches/:matchId/start`
- `POST /api/v1/sessions/:sessionId/matches/:matchId/complete`
- `POST /api/v1/sessions/:sessionId/matches/:matchId/cancel`
- `PATCH /api/v1/sessions/:sessionId/matches/:matchId/result`

Required behavior:

- Completing a match records the final outcome and applies stats/rating side effects according to session `ratingMode`.
- `PATCH /result` is correction-only after completion and must recompute affected players from the corrected match forward within the session.
- Recording a winner in a rated session should trigger rating history creation.
- Recording a draw in a rated session should apply a small expectation-based rating adjustment.
- Recording an unscored completion should not update ratings.
- Cancelling a match should not update ratings or leaderboard stats.
- Match assignment, start, completion, cancellation, and result actions must be idempotent under replay.

### Leaderboards

Purpose: show player rankings for the organizer in MVP v1.

Endpoints:

- `GET /api/v1/leaderboards/current` — **club** scope: cumulative stats across the organizer workspace.
- `GET /api/v1/sessions/:sessionId/leaderboard` — **session** scope: stats for that session only.

Optional query params (both): `sort`, `direction`. See `LeaderboardEntryDto` and sort options in `api-contracts.md`.

Required behavior:

- Each entry includes `wins`, `losses`, `draws`, `matchesPlayed`, `winRate`, `currentRating`, and `attendanceCount`.
- MVP leaderboard can sort by `rating`, `wins`, `losses`, `draws`, `matchesPlayed`, `winRate`, or `attendance`.
- Win rate uses `wins / (wins + losses + draws)`; return `null` when denominator is zero.
- `matchesPlayed` includes unscored completions; excludes cancelled.
- Cancelled matches do not affect leaderboard stats.
- Unscored matches count as matches played but do not affect win rate.
- Session scope: include players with a check-in for that session; `attendanceCount` is typically `1` per row.
- Club scope: `attendanceCount` is total session check-ins for that player.
- Public/player-facing leaderboard visibility is a future-version concern.

Frontend scope UX: `docs/specs/frontend/pages/leaderboard.md`.

## Error Shape

Use one consistent API error response:

```json
{
  "error": {
    "code": "COURT_ALREADY_OCCUPIED",
    "message": "Court 1 already has an active match.",
    "details": {}
  }
}
```

Sync errors should include the failed action ID when applicable:

```json
{
  "error": {
    "code": "COURT_ALREADY_OCCUPIED",
    "message": "Court 1 already has an active match.",
    "details": {
      "actionId": "client-action-id",
      "entityId": "court-1"
    }
  }
}
```

## Conflict Behavior

MVP v1 is optimized for one organizer device per live session, so deep multi-device conflict resolution is not required.

Required behavior:

- Accept idempotent replays of already-applied actions.
- Reject impossible transitions, such as assigning a player already in another active match.
- Return actionable errors that the frontend can show as `Sync failed`.
- Do not silently overwrite server state when a conflict is detected.
- Keep successful actions synced even if later actions in the batch fail, and report the failed subset.

## MVP Access Rules

MVP v1 access behavior is defined in `docs/specs/mvp-access.md`.

Summary:

- No login, no role checks, and no permission-denied UI in MVP v1.
- The only access lock is session mode: `completed` and `cancelled` sessions are read-only.
- Treat organizer endpoints as open application endpoints in MVP.

Future authorization rules (not enforced in MVP v1):

- `owner` and `organizer` can manage sessions, courts, check-ins, payments, queue, and matches.
- `player` can view own profile, own match history, own check-in status, and published leaderboards.
- Guests can access only the check-in and status views tied to their session link.
- Share session links and QR-based player check-in remain future-version behavior.
