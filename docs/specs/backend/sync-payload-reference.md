# Sync Payload Reference

Golden JSON examples for sync actions. Use with:

- `docs/specs/backend/sync-actions.md` — catalog, ordering, idempotency, invariants
- `docs/specs/backend/api-contracts.md` — API envelopes and DTO rules
- `docs/specs/backend/domain-model.md` — persisted entity fields

## When To Use This File

- Implementing the sync replay controller or client outbox serializer
- Writing contract tests and fixture data
- Reviewing whether a new feature needs a new action or an optional payload field

Do not duplicate semantic rules here. If behavior changes, update `sync-actions.md` first, then this file.

## Shared Shapes

### Sync action envelope

Every action in `POST /api/v1/sync/actions` uses this envelope. Field names are stable across action types.

```json
{
  "id": "client-action-uuid",
  "type": "CREATE_QUEUED_MATCH",
  "entityType": "queuedMatch",
  "entityId": "client-queued-match-id",
  "sessionId": "session-id",
  "payload": {},
  "createdAt": "2026-06-09T14:30:00.000Z"
}
```

### `SyncParticipantInput`

Reused anywhere participants are supplied in a sync payload (`CREATE_QUEUED_MATCH`, `UPDATE_QUEUED_MATCH`, `CREATE_MATCH`).

```json
{
  "playerProfileId": "player-ana",
  "checkInId": "checkin-ana",
  "team": "team_one",
  "slotOrder": 1
}
```

| Field | Required | Values |
|-------|----------|--------|
| `playerProfileId` | Yes | Organization player profile id |
| `checkInId` | Yes | Session check-in id |
| `team` | Yes | `team_one`, `team_two` |
| `slotOrder` | Yes | `1` or `2` within the team |

Rules:

- Persist only selected players. Incomplete queued matches omit empty slots from `participants`.
- `checkInId` must belong to `sessionId`.
- Promotion and direct assign copy team structure to `Match` participants.

### `MatchResultInput`

Reused by `COMPLETE_MATCH` and `UPDATE_MATCH_RESULT`. Semantics: `docs/specs/backend/match-results-and-ratings.md`.

```json
{
  "outcome": "team_one_win",
  "teamOneScore": 21,
  "teamTwoScore": 15,
  "winningTeam": "team_one"
}
```

| `outcome` | `winningTeam` | Scores |
|-----------|---------------|--------|
| `team_one_win` | `team_one` | Recommended |
| `team_two_win` | `team_two` | Recommended |
| `draw` | omit or `null` | Recommended |
| `unscored` | omit or `null` | Optional |

---

## High-Risk Actions

### `CREATE_QUEUED_MATCH`

Accept suggestion → stage in Next lane. Sets participants to `assigned`; queued match `ready` when four doubles players.

**Request** (single action excerpt):

```json
{
  "id": "sync-001-create-queued-match",
  "type": "CREATE_QUEUED_MATCH",
  "entityType": "queuedMatch",
  "entityId": "qm-suggest-001",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T14:30:00.000Z",
  "payload": {
    "sessionId": "session-friday",
    "queueLaneId": "lane-queue-1",
    "sortOrder": 0,
    "status": "ready",
    "createdFrom": "suggestion",
    "participants": [
      { "playerProfileId": "player-ana", "checkInId": "ci-ana", "team": "team_one", "slotOrder": 1 },
      { "playerProfileId": "player-ben", "checkInId": "ci-ben", "team": "team_one", "slotOrder": 2 },
      { "playerProfileId": "player-cara", "checkInId": "ci-cara", "team": "team_two", "slotOrder": 1 },
      { "playerProfileId": "player-dan", "checkInId": "ci-dan", "team": "team_two", "slotOrder": 2 }
    ]
  }
}
```

**Draft** (manual build, two players so far):

```json
{
  "id": "sync-002-create-queued-draft",
  "type": "CREATE_QUEUED_MATCH",
  "entityType": "queuedMatch",
  "entityId": "qm-draft-001",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T14:31:00.000Z",
  "payload": {
    "sessionId": "session-friday",
    "queueLaneId": "lane-queue-1",
    "sortOrder": 1,
    "status": "draft",
    "createdFrom": "manual",
    "participants": [
      { "playerProfileId": "player-eli", "checkInId": "ci-eli", "team": "team_one", "slotOrder": 1 },
      { "playerProfileId": "player-fay", "checkInId": "ci-fay", "team": "team_one", "slotOrder": 2 }
    ]
  }
}
```

**Success result**:

```json
{
  "actionId": "sync-001-create-queued-match",
  "status": "applied",
  "entityType": "queuedMatch",
  "entityId": "qm-suggest-001",
  "canonicalEntityId": "qm-suggest-001",
  "serverVersion": 42,
  "serverUpdatedAt": "2026-06-09T14:30:01.000Z"
}
```

**Common failures**:

| Code | When |
|------|------|
| `CHECK_IN_NOT_FOUND` | `checkInId` invalid for session |
| `PLAYER_ALREADY_ON_COURT` | Participant is `playing` on another court match |
| `QUEUE_LANE_NOT_FOUND` | `queueLaneId` missing or wrong session |

---

### `MOVE_QUEUED_MATCH_TO_COURT`

Promote `ready` queued match → `assigned` court match.

**Request**:

```json
{
  "id": "sync-010-promote",
  "type": "MOVE_QUEUED_MATCH_TO_COURT",
  "entityType": "queuedMatch",
  "entityId": "qm-suggest-001",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T14:35:00.000Z",
  "payload": {
    "courtId": "court-1",
    "matchId": "match-promoted-001",
    "assignedAt": "2026-06-09T14:35:00.000Z"
  }
}
```

**Success result** (client should store `canonicalEntityId` for the created match):

```json
{
  "actionId": "sync-010-promote",
  "status": "applied",
  "entityType": "queuedMatch",
  "entityId": "qm-suggest-001",
  "canonicalEntityId": "qm-suggest-001",
  "createdEntities": [
    {
      "entityType": "match",
      "clientEntityId": "match-promoted-001",
      "canonicalEntityId": "match-promoted-001"
    }
  ],
  "serverVersion": 43,
  "serverUpdatedAt": "2026-06-09T14:35:01.000Z"
}
```

`createdEntities` is optional in the result envelope but recommended when promotion creates a new `match` id.

**Common failures**:

| Code | When |
|------|------|
| `QUEUED_MATCH_NOT_READY` | Fewer than four participants or `draft` |
| `COURT_ALREADY_OCCUPIED` | Court not `open` |
| `COURT_NOT_FOUND` | Invalid `courtId` |

---

### `COMPLETE_MATCH`

Record final result and apply leaderboard/rating side effects once.

**Request** (rated session, scored win):

```json
{
  "id": "sync-020-complete",
  "type": "COMPLETE_MATCH",
  "entityType": "match",
  "entityId": "match-promoted-001",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T14:50:00.000Z",
  "payload": {
    "outcome": "team_one_win",
    "teamOneScore": 21,
    "teamTwoScore": 18,
    "winningTeam": "team_one",
    "endedAt": "2026-06-09T14:50:00.000Z"
  }
}
```

**Request** (casual session, unscored):

```json
{
  "id": "sync-021-complete-unscored",
  "type": "COMPLETE_MATCH",
  "entityType": "match",
  "entityId": "match-promoted-002",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T15:00:00.000Z",
  "payload": {
    "outcome": "unscored",
    "endedAt": "2026-06-09T15:00:00.000Z"
  }
}
```

**Success result**:

```json
{
  "actionId": "sync-020-complete",
  "status": "applied",
  "entityType": "match",
  "entityId": "match-promoted-001",
  "canonicalEntityId": "match-promoted-001",
  "serverVersion": 44,
  "serverUpdatedAt": "2026-06-09T14:50:01.000Z",
  "sideEffects": {
    "ratingApplied": true,
    "leaderboardUpdated": true
  }
}
```

`sideEffects` is optional metadata for client UI; server truth remains in updated match and participant rows.

**Idempotent replay**:

```json
{
  "actionId": "sync-020-complete",
  "status": "already_applied",
  "entityType": "match",
  "entityId": "match-promoted-001",
  "canonicalEntityId": "match-promoted-001",
  "serverVersion": 44,
  "serverUpdatedAt": "2026-06-09T14:50:01.000Z"
}
```

**Common failures**:

| Code | When |
|------|------|
| `MATCH_NOT_IN_PROGRESS` | Match not `in_progress` (`START_MATCH` missing) |
| `INVALID_MATCH_OUTCOME` | `winningTeam` missing for a win outcome |

---

### `UPDATE_MATCH_RESULT`

Correction **after** completion only. Recomputes ratings/stats from this match forward in the session.

**Request** (fix wrong winner):

```json
{
  "id": "sync-030-correct-result",
  "type": "UPDATE_MATCH_RESULT",
  "entityType": "match",
  "entityId": "match-promoted-001",
  "sessionId": "session-friday",
  "createdAt": "2026-06-09T16:00:00.000Z",
  "payload": {
    "outcome": "team_two_win",
    "teamOneScore": 18,
    "teamTwoScore": 21,
    "winningTeam": "team_two",
    "correctionNote": "Score entered on wrong side"
  }
}
```

**Success result**:

```json
{
  "actionId": "sync-030-correct-result",
  "status": "applied",
  "entityType": "match",
  "entityId": "match-promoted-001",
  "canonicalEntityId": "match-promoted-001",
  "serverVersion": 55,
  "serverUpdatedAt": "2026-06-09T16:00:01.000Z",
  "sideEffects": {
    "ratingRecomputed": true,
    "leaderboardRecomputed": true,
    "recomputeScope": "session"
  }
}
```

**Common failures**:

| Code | When |
|------|------|
| `MATCH_NOT_COMPLETED` | Match still `assigned` or `in_progress` |
| `CORRECTION_NOT_ALLOWED` | Session or match locked per product rules |

---

## Dependency Chain Example

Typical pegboard path in one sync batch (order matters):

```json
{
  "organizationId": "org-default",
  "deviceId": "tablet-1",
  "actions": [
    {
      "id": "sync-001-create-queued-match",
      "type": "CREATE_QUEUED_MATCH",
      "entityType": "queuedMatch",
      "entityId": "qm-001",
      "sessionId": "session-friday",
      "createdAt": "2026-06-09T14:30:00.000Z",
      "payload": {
        "sessionId": "session-friday",
        "queueLaneId": "lane-1",
        "sortOrder": 0,
        "status": "ready",
        "createdFrom": "suggestion",
        "participants": []
      }
    },
    {
      "id": "sync-010-promote",
      "type": "MOVE_QUEUED_MATCH_TO_COURT",
      "entityType": "queuedMatch",
      "entityId": "qm-001",
      "sessionId": "session-friday",
      "createdAt": "2026-06-09T14:35:00.000Z",
      "payload": {
        "courtId": "court-1",
        "matchId": "match-001",
        "assignedAt": "2026-06-09T14:35:00.000Z"
      }
    },
    {
      "id": "sync-015-start",
      "type": "START_MATCH",
      "entityType": "match",
      "entityId": "match-001",
      "sessionId": "session-friday",
      "createdAt": "2026-06-09T14:36:00.000Z",
      "payload": {
        "startedAt": "2026-06-09T14:36:00.000Z"
      }
    },
    {
      "id": "sync-020-complete",
      "type": "COMPLETE_MATCH",
      "entityType": "match",
      "entityId": "match-001",
      "sessionId": "session-friday",
      "createdAt": "2026-06-09T14:50:00.000Z",
      "payload": {
        "outcome": "team_one_win",
        "teamOneScore": 21,
        "teamTwoScore": 15,
        "winningTeam": "team_one",
        "endedAt": "2026-06-09T14:50:00.000Z"
      }
    }
  ]
}
```

Omit full `participants` in the chain snippet above only for brevity in docs; real client payloads must include complete participant arrays.

If `sync-010-promote` fails, `sync-015-start` and `sync-020-complete` return `blocked` with a dependency error.

---

## Adding New Actions Or Fields

1. Add the action to `sync-actions.md` with use case, entity, rules, and idempotency.
2. Add a golden example to this file if the payload is non-trivial or high-risk.
3. Prefer **optional** new payload fields for additive product changes.
4. Do not rename existing payload fields without a new API/sync major version.
5. When implementation begins, add matching JSON Schema under `schemas/sync/v1/` (see `sync-actions.md` Payload Documentation Convention).
