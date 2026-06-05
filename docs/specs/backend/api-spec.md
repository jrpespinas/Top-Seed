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

## Resource Groups

### Sync

Purpose: accept locally queued organizer actions and reconcile them with server state after disconnection.

Endpoints:

- `POST /api/sync/actions`
- `GET /api/sync/status`

`POST /api/sync/actions` request shape:

```json
{
  "workspaceId": "local-workspace",
  "deviceId": "organizer-device",
  "actions": [
    {
      "id": "client-action-id",
      "type": "MARK_PAID",
      "entityType": "checkIn",
      "entityId": "check-in-id",
      "payload": {},
      "createdAt": "2026-06-06T00:00:00.000Z"
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
- Acknowledge server timestamps and canonical IDs for locally created entities.

### Organizations

Purpose: manage club, group, venue, or default organizer workspace data. In MVP v1 this may be a single local/default workspace.

Endpoints:

- `GET /api/organizations/current`
- `PATCH /api/organizations/current`

### Players

Purpose: maintain organizer-managed reusable player records.

Endpoints:

- `GET /api/players`
- `POST /api/players`
- `GET /api/players/:playerId`
- `PATCH /api/players/:playerId`
- `GET /api/players/:playerId/history`

Required behavior:

- Search by display name and phone.
- Allow organizer-created player profiles without login accounts.
- Do not delete players with match history; mark them inactive.

### Sessions

Purpose: create and run badminton sessions.

Endpoints:

- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:sessionId`
- `PATCH /api/sessions/:sessionId`
- `POST /api/sessions/:sessionId/open`
- `POST /api/sessions/:sessionId/start`
- `POST /api/sessions/:sessionId/complete`
- `POST /api/sessions/:sessionId/cancel`

Required behavior:

- Only `draft` sessions can be opened.
- Only `open` sessions can become `active`.
- Completing a session should close open courts and mark remaining waiting players as done.

### Courts

Purpose: manage session courts.

Endpoints:

- `GET /api/sessions/:sessionId/courts`
- `POST /api/sessions/:sessionId/courts`
- `PATCH /api/sessions/:sessionId/courts/:courtId`
- `POST /api/sessions/:sessionId/courts/:courtId/pause`
- `POST /api/sessions/:sessionId/courts/:courtId/reopen`

Required behavior:

- A court with an active match cannot be paused without cancelling or completing the match.

### Check-Ins

Purpose: track attendance, queue state, session rating, and payment status.

Endpoints:

- `GET /api/sessions/:sessionId/check-ins`
- `POST /api/sessions/:sessionId/check-ins`
- `PATCH /api/sessions/:sessionId/check-ins/:checkInId`
- `POST /api/sessions/:sessionId/check-ins/:checkInId/remove`
- `POST /api/sessions/:sessionId/check-ins/:checkInId/restore`

Required behavior:

- Prevent duplicate active check-ins for the same player in a session.
- Assign `arrivalOrder` when the check-in is created.
- Allow organizer to override `sessionSkillRating` for the current session.
- Accept client-generated IDs or idempotency keys for offline-created check-ins.

### Payments

Purpose: manually track session payment state.

Endpoints:

- `GET /api/sessions/:sessionId/payments`
- `PATCH /api/sessions/:sessionId/check-ins/:checkInId/payment`

Required behavior:

- Payment updates must capture status, amount paid, method, notes, and updater.
- Payment status must not change global player records.
- Payment updates may arrive later through sync and must remain idempotent.

### Queue

Purpose: generate and manage next-match suggestions.

Endpoints:

- `GET /api/sessions/:sessionId/queue`
- `POST /api/sessions/:sessionId/queue/suggestions`
- `POST /api/sessions/:sessionId/queue/manual-assignment`

Required behavior:

- Suggestions must be deterministic for the same input.
- Organizer can accept, regenerate, or manually override suggestions.
- Manual assignment should use the same match creation path as accepted suggestions.
- Offline-generated suggestions should sync as ordinary accepted or manual match assignments, not as opaque algorithm state.

### Matches

Purpose: assign courts, record results, and update history.

Endpoints:

- `GET /api/sessions/:sessionId/matches`
- `POST /api/sessions/:sessionId/matches`
- `POST /api/sessions/:sessionId/matches/:matchId/start`
- `POST /api/sessions/:sessionId/matches/:matchId/complete`
- `POST /api/sessions/:sessionId/matches/:matchId/cancel`
- `PATCH /api/sessions/:sessionId/matches/:matchId/result`

Required behavior:

- Completing a match should release players to `resting` or `waiting` based on queue policy.
- Recording a winner should trigger rating history creation.
- Cancelling a match should not update ratings.
- Match assignment, start, completion, cancellation, and result actions must be idempotent under replay.

### Leaderboards

Purpose: show simple player rankings for the organizer in MVP v1.

Endpoints:

- `GET /api/leaderboards/current`
- `GET /api/sessions/:sessionId/leaderboard`

Required behavior:

- MVP leaderboard can sort by current rating, wins, games played, or attendance.
- Public/player-facing leaderboard visibility is a future-version concern.

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

MVP v1 has no login component. Treat all endpoints as organizer-operated application endpoints. The frontend should not expose player-owned check-in, guest status links, or authenticated profile flows in v1.

Future authorization rules:

- `owner` and `organizer` can manage sessions, courts, check-ins, payments, queue, and matches.
- `player` can view own profile, own match history, own check-in status, and published leaderboards.
- Guests can access only the check-in and status views tied to their session link.
