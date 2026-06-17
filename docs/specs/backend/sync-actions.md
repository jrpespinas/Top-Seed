# Sync Actions Spec

## Purpose

Define the canonical sync action catalog for local-first MVP operation.

The organizer app writes live-session mutations to the browser local store first, then enqueues sync actions. When connectivity returns, the backend processes those actions through the same application use cases used by direct API mutations.

This file is the source of truth for sync action names, payload intent, ordering, idempotency, and per-action results.

State transition side effects are defined in `docs/specs/backend/state-transitions.md`.

## Core Decisions

- Use `organizationId` everywhere. MVP v1 uses one default organization; do not introduce a separate `workspaceId` model.
- Use intent/use-case action names, not generic CRUD actions.
- Include all organizer live-session mutations needed to run a session offline.
- Defer auth, player-owned self-service, public boards, online payments, and multi-device collaboration actions.
- Process actions in session order when actions are related.
- If an action fails, stop later actions that depend on it, but continue independent actions when safe.

## Sync Request Shape

```json
{
  "organizationId": "default-organization-id",
  "deviceId": "organizer-device-id",
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

Rules:

- `actions[].id` is the idempotency key.
- `organizationId`, `deviceId`, `type`, `entityType`, `entityId`, `payload`, and `createdAt` are required.
- `sessionId` is required for session-scoped actions.
- `entityId` should be the client-generated ID for creates.
- Payloads should include enough data for the corresponding use case to run without consulting client-only state.

## Payload Documentation Convention

Long-term sync contracts use three layers:

| Layer | File | Purpose |
|-------|------|---------|
| **Catalog** | `sync-actions.md` (this file) | Action names, semantics, ordering, idempotency, invariants |
| **Reference** | `sync-payload-reference.md` | Golden JSON request/result examples and shared input shapes |
| **Schema** (implementation phase) | `schemas/sync/v1/*.json` | Machine-readable JSON Schema for CI validation and codegen |

Rules for all layers:

- **Additive evolution**: new optional payload fields and new action types are allowed within `/api/v1`. Clients and servers must ignore unknown fields they do not understand.
- **Breaking changes**: renaming or removing fields, or changing required fields, requires a future API/sync major version — not silent drift.
- **Shared shapes**: reuse documented inputs such as `SyncParticipantInput` and `MatchResultInput` instead of inventing per-action participant JSON.
- **No opaque blobs**: do not sync suggestion algorithm state, UI selection, or rejected suggestions. Sync intent as domain actions (`CREATE_QUEUED_MATCH`, etc.).
- **Examples follow semantics**: update `sync-actions.md` first when behavior changes, then update `sync-payload-reference.md`.

When adding an action:

1. Document it in **Action Catalog** below.
2. Add a golden example to `sync-payload-reference.md` if the payload is non-trivial, has side effects, or is replay-sensitive.
3. Add JSON Schema when backend/client implementation starts.

High-risk actions with reference payloads (MVP):

- `CREATE_QUEUED_MATCH`
- `MOVE_QUEUED_MATCH_TO_COURT`
- `COMPLETE_MATCH`
- `UPDATE_MATCH_RESULT`

See also: `docs/specs/backend/api-contracts.md` for API envelopes and DTO rules.

## Sync Response Shape

```json
{
  "organizationId": "default-organization-id",
  "deviceId": "organizer-device-id",
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

Allowed result statuses:

- `applied`: action was applied during this sync request.
- `already_applied`: action was previously applied and is safe to mark synced locally.
- `failed`: action could not be applied; later dependent actions should be blocked.
- `blocked`: action was not attempted because an earlier dependency failed.

Optional per-result fields (see `sync-payload-reference.md`):

- `createdEntities`: client-to-canonical ID map when an action creates related records (e.g. promotion creates `match`).
- `sideEffects`: UI hints such as `ratingApplied` or `leaderboardRecomputed`; server state remains authoritative.

Failed result shape:

```json
{
  "actionId": "client-action-id",
  "status": "failed",
  "entityType": "court",
  "entityId": "court-id",
  "error": {
    "code": "COURT_ALREADY_OCCUPIED",
    "message": "Court 1 already has an active match.",
    "details": {
      "courtId": "court-id"
    }
  }
}
```

## Ordering And Failure Semantics

Default behavior:

- Preserve `createdAt` order for actions with the same `sessionId`.
- Preserve dependency order when one action references an entity created or changed by an earlier action.
- Continue independent actions when safe.
- Return one result per input action.

Dependency examples:

- `CREATE_QUEUE_LANE` must be applied before `CREATE_QUEUED_MATCH` targeting that lane.
- `CREATE_QUEUED_MATCH` must be applied before `MOVE_QUEUED_MATCH_TO_COURT`.
- `CHECK_IN_PLAYER` must be applied before that check-in appears in a queued match or active match.
- `MOVE_QUEUED_MATCH_TO_COURT` must be applied before `START_MATCH` for the resulting match.
- `START_MATCH` must be applied before `COMPLETE_MATCH`.

If a dependency fails:

- Mark the failed action `failed`.
- Mark dependent later actions `blocked` with a dependency error.
- Continue unrelated actions, such as a payment update for another check-in.

## Idempotency Rules

- Applying the same `action.id` twice must not duplicate records or side effects.
- Idempotency is scoped to `organizationId` and `deviceId`.
- Create actions must use stable client-generated entity IDs.
- Replayed create actions should return `already_applied` and canonical IDs.
- Replayed update actions should return `already_applied` when the same payload already produced the current server state.
- Replayed completion actions must not apply rating changes twice.

## Action Catalog

### Player Actions

#### `CREATE_PLAYER_PROFILE`

Use case: `CreatePlayerProfile`

Entity:

- `entityType`: `playerProfile`
- `entityId`: client-generated player profile ID.

Payload:

- `displayName`
- `phone`
- `gender`: optional.
- `defaultSkillRating`
- `notes`
- `isActive`

Idempotency:

- Same action must not create duplicate player profiles.

#### `UPDATE_PLAYER_PROFILE`

Use case: `UpdatePlayerProfile`

Payload:

- Editable player fields: `displayName`, `phone`, `gender`, `defaultSkillRating`, `notes`, `isActive`.

Rules:

- Use for organizer edits to name, gender, and level/rating.
- Do not use for player-owned profile updates in MVP.

### Session Actions

#### `CREATE_SESSION`

Use case: `CreateSession`

Payload:

- `name`
- `venueName`
- `startsAt`
- `endsAt`
- `feeAmount`
- `currency`
- `queueMode`
- `requirePaymentBeforePlay` (optional in MVP v1; if omitted, treat as `false`)
- `ratingMode`: `casual` or `rated`.

Rules:

- New sessions should create default local configuration, including at least one queue lane when the session becomes active.
- MVP v1 must not gate queueing on payment. Ignore or reject `requirePaymentBeforePlay: true` until payment gating is a supported product feature.

#### `UPDATE_SESSION`

Use case: `UpdateSession`

Payload:

- Editable session setup fields.

Rules:

- Do not use to bypass lifecycle transitions.

#### `OPEN_SESSION`

Use case: `OpenSession`

Payload:

- Optional `openedAt`.

#### `START_SESSION`

Use case: `StartSession`

Payload:

- Optional `startedAt`.

#### `COMPLETE_SESSION`

Use case: `CompleteSession`

Payload:

- Optional `completedAt`.

Rules:

- Must close or resolve live session state according to the session lifecycle rules.

#### `CANCEL_SESSION`

Use case: `CancelSession`

Payload:

- Optional `cancelledAt`.
- Optional `reason`.

### Court Actions

#### `CREATE_COURT`

Use case: `CreateCourt`

Entity:

- `entityType`: `court`
- `entityId`: client-generated court ID.

Payload:

- `sessionId`
- `name`
- `sortOrder`
- Optional `status`, defaulting to `open`.

#### `UPDATE_COURT`

Use case: `UpdateCourt`

Payload:

- `name`
- `sortOrder`
- Optional status or note fields when supported by the court spec.

#### `DELETE_COURT`

Use case: `DeleteCourt`

Rules:

- Only courts without active matches can be deleted.
- Deleting a court must not delete completed match history.

#### `PAUSE_COURT`

Use case: `PauseCourt`

Rules:

- A court with an active match cannot be paused without resolving the match.

#### `REOPEN_COURT`

Use case: `ReopenCourt`

Rules:

- Reopens a paused or unavailable court when allowed.

#### `MARK_COURT_UNAVAILABLE`

Use case: `MarkCourtUnavailable`

Payload:

- Optional `reason`.

Rules:

- Unavailable courts must not receive queued or suggested matches.

### Check-In Actions

#### `CHECK_IN_PLAYER`

Use case: `CheckInPlayer`

Entity:

- `entityType`: `checkIn`
- `entityId`: client-generated check-in ID.

Payload:

- `sessionId`
- `playerProfileId`
- `arrivalOrder`
- `checkedInAt`
- `sessionSkillRating`
- Initial payment fields.

Rules:

- Prevent duplicate active check-ins for the same player in the same session.
- Initial `queueStatus` is `waiting`.

#### `UPDATE_CHECK_IN`

Use case: `UpdateCheckIn`

Payload:

- `queueStatus`
- `sessionSkillRating`
- `suggestionExcluded`
- `suggestionExcludeNote`
- Optional session-specific notes when supported.

Rules:

- Use for organizer edits that do not fit a more specific action.
- Use for manual `resting`, back-to-waiting, and `done` transitions per `docs/specs/backend/state-transitions.md`.
- Use **Skip suggestions** / **Clear skip** via `suggestionExcluded` and optional `suggestionExcludeNote`.
- Do not mark `done` or `removed` while the player is `playing`.

#### `REMOVE_CHECK_IN`

Use case: `RemoveCheckIn`

Payload:

- Optional `reason`.

Rules:

- Cannot remove a player from an active match without cancelling or completing the match first.

#### `RESTORE_CHECK_IN`

Use case: `RestoreCheckIn`

Payload:

- Target `queueStatus`, usually `waiting`.

### Queue Lane Actions

#### `CREATE_QUEUE_LANE`

Use case: `CreateQueueLane`

Entity:

- `entityType`: `queueLane`
- `entityId`: client-generated queue lane ID.

Payload:

- `sessionId`
- `name`
- `sortOrder`

#### `UPDATE_QUEUE_LANE`

Use case: `UpdateQueueLane`

Payload:

- `name`
- `sortOrder`
- `status`

#### `REORDER_QUEUE_LANES`

Use case: `ReorderQueueLanes`

Payload:

- `orderedLaneIds`

Rules:

- Must include only queue lanes for the same session.

#### `DELETE_QUEUE_LANE`

Use case: `DeleteQueueLane`

Payload:

- Optional `deleteQueuedMatches`, expected to be `true` when lane contains queued matches.

Rules:

- Backend does not own UI confirmation, but it must enforce final-lane and active-match invariants.
- Deleting a lane removes queued matches still staged inside that lane.
- Deleting a lane must not affect matches already assigned to courts.

### Queued Match Actions

#### `CREATE_QUEUED_MATCH`

Use case: `CreateQueuedMatch`

Entity:

- `entityType`: `queuedMatch`
- `entityId`: client-generated queued match ID.

Payload:

- `sessionId`
- `queueLaneId`
- `sortOrder`
- `status`: `draft` or `ready` for doubles when known at create time.
- `createdFrom`: `manual` or `suggestion`.
- `participants`: array of `SyncParticipantInput` (see `sync-payload-reference.md`).

Golden examples: `docs/specs/backend/sync-payload-reference.md` § `CREATE_QUEUED_MATCH`.

Rules:

- Accepted suggestions sync as created queued matches, not as opaque algorithm state.
- Set participant `queueStatus` to `assigned`.
- Set queued match `status` to `draft` when fewer than four participants; `ready` when complete for doubles.

#### `UPDATE_QUEUED_MATCH`

Use case: `UpdateQueuedMatch`

Payload:

- `queueLaneId`
- `sortOrder`
- `status`
- `participants`

Rules:

- Use for swapping players, swapping teams, or filling incomplete queued matches.
- Adding or removing participants updates `draft`/`ready` status and participant `queueStatus` per `docs/specs/backend/state-transitions.md`.
- A player may appear in multiple queued matches across lanes.

#### `REMOVE_QUEUED_MATCH`

Use case: `RemoveQueuedMatch`

Rules:

- Removing a queued match must not delete players, check-ins, or completed match history.
- Release participants to `waiting` only when they are not in another queued match or active court roster.

#### `MOVE_QUEUED_MATCH_TO_LANE`

Use case: `MoveQueuedMatchToLane`

Payload:

- `targetQueueLaneId`
- `sortOrder`

#### `MOVE_QUEUED_MATCH_TO_COURT`

Use case: `PromoteQueuedMatchToCourt`

Payload:

- `courtId`
- `matchId`: client-generated match ID created by promotion.
- Optional `assignedAt`.

Golden examples: `docs/specs/backend/sync-payload-reference.md` § `MOVE_QUEUED_MATCH_TO_COURT`.

Rules:

- Requires a complete queued match (`ready`).
- Requires an open target court.
- Creates a normal `Match` with `assigned` status and marks the queued match `promoted`.
- Sets court to `occupied`.
- Removes promoted players from all other queued matches in the session.
- Downgrades affected queued matches from `ready` to `draft` when below four players.

### Match Actions

#### `CREATE_MATCH`

Use case: `CreateMatch`

Payload:

- `sessionId`
- `courtId`
- `participants`
- Optional `createdFrom`.

Rules:

- Use only for direct manual assignment that intentionally skips queue staging.
- Prefer `CREATE_QUEUED_MATCH` followed by `MOVE_QUEUED_MATCH_TO_COURT` for normal dashboard flow.
- Sets participant `queueStatus` to `assigned` and court to `occupied`.
- Frontend should show copy such as `Assigned directly — skipped Next queue`.

#### `START_MATCH`

Use case: `StartMatch`

Payload:

- Optional `startedAt`.

Rules:

- Requires match `assigned`.
- Sets match to `in_progress`.
- Sets all participants to `playing`.

#### `UPDATE_MATCH_RESULT`

Use case: `UpdateMatchResult`

Purpose:

- Correct a completed match result after completion.
- Do not use for draft score entry before completion in MVP.

Payload:

- `MatchResultInput` fields (see `sync-payload-reference.md`).
- Optional `correctionNote` for organizer audit.

Golden examples: `docs/specs/backend/sync-payload-reference.md` § `UPDATE_MATCH_RESULT`.

Rules:

- A draw must not be counted as a win for both sides.
- Corrections must follow `docs/specs/backend/match-results-and-ratings.md`.
- Corrections should recompute affected players from the corrected match forward within the session.
- Correction replay must be idempotent.

#### `COMPLETE_MATCH`

Use case: `CompleteMatch`

Payload:

- `MatchResultInput` fields (see `sync-payload-reference.md`).
- Optional `endedAt`.

Golden examples: `docs/specs/backend/sync-payload-reference.md` § `COMPLETE_MATCH`.

Rules:

- Completion should apply rating and history side effects exactly once.
- Completion records the final result; do not require a separate `UPDATE_MATCH_RESULT` action before completion.
- Rated sessions apply rating changes for wins and draws.
- Casual sessions, unscored outcomes, and cancelled matches do not apply rating changes.
- Sets match to `completed`, releases court to `open`, and returns participants to `waiting`.
- Keep participants `assigned` when they remain in another `draft` or `ready` queued match.

#### `CANCEL_MATCH`

Use case: `CancelMatch`

Payload:

- Optional `reason`.

Rules:

- Cancelled matches do not update ratings.
- Sets match to `cancelled`, releases court to `open`, and returns all participants to `waiting`.

### Payment Actions

#### `UPDATE_PAYMENT`

Use case: `UpdatePayment`

Entity:

- `entityType`: `checkIn`
- `entityId`: check-in ID.

Payload:

- `paymentStatus`: `unpaid`, `paid`, `partial`, `waived`, or `refunded`.
- `paymentAmountDue`
- `paymentAmountPaid`
- `paymentMethod`
- `paymentNotes`
- `updatedAt`

Rules:

- Payment status is session-specific.
- Do not update global player profile records.
- Replaying the same payment update must not double count totals.

## Non-Sync Actions

Do not persist these as sync actions in MVP:

- Rejected suggestions.
- Pure local UI state such as selected tab, open drawer, selected queue lane, or unsaved form input.
- Future player-auth actions.
- Online payment gateway events.
- Public/player-facing live board subscriptions.

## Testing Expectations

Sync tests should cover:

- Duplicate action replay returns `already_applied`.
- Create action replay does not duplicate entities.
- Dependent actions become `blocked` after a failed dependency.
- Independent actions continue after an unrelated failure.
- `COMPLETE_MATCH` replay does not double-apply rating changes.
- `DELETE_QUEUE_LANE` replay does not delete assigned or completed matches.
- `UPDATE_PAYMENT` replay does not double count payment totals.
- Client-generated IDs reconcile to canonical IDs in the sync response.
