# API Contracts Spec

## Purpose

Define stable API schema conventions for Top Seed.

The backend uses REST-style resource and workflow endpoints with explicit DTOs. The MVP has no login, but contracts should be secure, versioned, and durable enough for future organizer accounts, player self-service, public leaderboards, and multi-device sync.

Use this file with:

- `docs/specs/backend/api-spec.md`
- `docs/specs/backend/backend-architecture.md`
- `docs/specs/backend/sync-actions.md`
- `docs/specs/backend/sync-payload-reference.md`
- `docs/specs/backend/domain-model.md`

## API Style

Use REST with a small number of workflow endpoints for domain actions.

Endpoint categories:

- Resource endpoints for ordinary reads and edits.
- Workflow endpoints for domain transitions such as starting matches, completing matches, promoting queued matches, or marking courts unavailable.
- Sync endpoints for offline action replay.
- Aggregate snapshot endpoints for frontend efficiency on operational screens.

Do not use GraphQL or microservice-style APIs for MVP.

## Versioning

All backend endpoints should use a URL version prefix:

```text
/api/v1
```

Rules:

- New MVP endpoints should start under `/api/v1`.
- Do not add unversioned `/api` endpoints.
- Breaking response or request shape changes require a future version prefix.
- Non-breaking additions may add optional fields to existing DTOs.

## Response Envelopes

### Single Resource Or Aggregate Response

Use `{ data, meta }`.

```json
{
  "data": {
    "id": "session-id"
  },
  "meta": {
    "serverTime": "2026-06-09T00:00:00.000Z",
    "serverVersion": 12
  }
}
```

### List Response

Use `{ data, page, meta }`.

```json
{
  "data": [],
  "page": {
    "nextCursor": "opaque-cursor",
    "hasMore": true,
    "limit": 50
  },
  "meta": {
    "serverTime": "2026-06-09T00:00:00.000Z"
  }
}
```

### Sync Response

`POST /api/v1/sync/actions` follows the sync action response shape in `docs/specs/backend/sync-actions.md`.

It may omit the top-level `data` envelope because per-action sync results are already the main response contract.

## Pagination

Use cursor pagination for list endpoints.

Request query parameters:

- `cursor`: optional opaque cursor from a previous response.
- `limit`: optional item limit. Default should be endpoint-specific and conservative.

Response page fields:

- `nextCursor`: opaque cursor for the next page, or `null` when no more pages exist.
- `hasMore`: boolean.
- `limit`: applied page size.

Rules:

- Cursors must be opaque to clients.
- Clients must not construct cursors.
- Default sort order must be documented per endpoint.
- Avoid offset pagination for MVP API contracts.
- Small lists can return all records, but should still use the list envelope when the endpoint returns an array.

## IDs And Timestamps

IDs:

- Use string IDs in API DTOs.
- Accept client-generated IDs for offline-created entities.
- Use `organizationId` for MVP organization scope.
- Do not expose internal database sequence assumptions.

Timestamps:

- Use ISO 8601 UTC strings.
- Include `createdAt` and `updatedAt` in persisted DTOs.
- Include `serverTime` in `meta`.
- Include `serverVersion` or equivalent revision where useful for local-first reconciliation.

## DTO Rules

DTOs are API contracts, not database rows.

Rules:

- Do not return raw ORM records.
- Do not expose private implementation fields.
- Use frontend-friendly nesting when it reduces request count.
- Keep write DTOs allowlisted by use case.
- Ignore or reject unknown write fields according to validation policy; do not persist arbitrary payload keys.
- Use enum strings that match domain specs.

Naming:

- Use `camelCase` JSON fields.
- Use `id`, `createdAt`, `updatedAt`, and `syncStatus` consistently.
- Use UI-safe labels only when a DTO is intentionally denormalized for display.

## Error Envelope

Use one error shape:

```json
{
  "error": {
    "code": "COURT_ALREADY_OCCUPIED",
    "message": "Court 1 already has an active match.",
    "details": {
      "courtId": "court-id"
    }
  },
  "meta": {
    "serverTime": "2026-06-09T00:00:00.000Z"
  }
}
```

Rules:

- `code` must be stable and safe for frontend branching.
- `message` should be human-readable and safe to display.
- `details` should not expose secrets or internal stack traces.
- Validation errors should identify fields.
- Sync errors should include the failed `actionId` when applicable.

## Error Code Registry

Stable `error.code` values for API and sync responses. Controllers map domain errors to these codes; do not invent ad hoc strings.

Add new codes here before use. Prefer specific codes over generic `INVALID_REQUEST` when the client can recover.

### Session

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `SESSION_NOT_FOUND` | Invalid `sessionId` | Session not found. |
| `SESSION_NOT_ACTIVE` | Mutation on completed/cancelled session | This session is no longer live. |
| `SESSION_ALREADY_ACTIVE` | Invalid lifecycle transition | Session is already active. |

### Check-in and players

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `PLAYER_ALREADY_CHECKED_IN` | Duplicate check-in | Player is already checked in. |
| `CHECK_IN_NOT_FOUND` | Invalid check-in id | Check-in not found. |
| `PLAYER_NOT_FOUND` | Invalid profile id | Player not found. |
| `PLAYER_ALREADY_ASSIGNED` | Court/queue conflict | Player is already on a court or staged match. |
| `PLAYER_IS_PLAYING` | Remove/done while on court | Finish or cancel the match first. |

### Courts and matches

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `COURT_NOT_FOUND` | Invalid court id | Court not found. |
| `COURT_ALREADY_OCCUPIED` | Assign to busy court | Court already has an active match. |
| `COURT_NOT_OPEN` | Promote to paused/unavailable court | Court is not available. |
| `MATCH_NOT_FOUND` | Invalid match id | Match not found. |
| `MATCH_NOT_IN_PROGRESS` | Complete before start | Start the match before recording a result. |
| `MATCH_NOT_COMPLETED` | Correct result too early | Record the match result first. |
| `INVALID_MATCH_OUTCOME` | Payload vs outcome mismatch | Result does not match the scores. |

### Queue lanes and staged matches

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `QUEUE_LANE_NOT_FOUND` | Invalid lane id | Queue lane not found. |
| `QUEUE_LANE_REQUIRED` | Delete final lane | At least one queue lane is required. |
| `QUEUED_MATCH_NOT_FOUND` | Invalid queued match id | Queued match not found. |
| `QUEUED_MATCH_NOT_READY` | Promote incomplete match | Add all players before sending to court. |
| `QUEUED_MATCH_INCOMPLETE` | Fewer than four players | Match needs four players. |

### Payments

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `INVALID_PAYMENT_TRANSITION` | Illegal status change | That payment change is not allowed. |
| `PAYMENT_AMOUNT_INVALID` | Negative or inconsistent amounts | Check the amount paid. |

### Sync

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `SYNC_ACTION_ALREADY_APPLIED` | Idempotent replay | Already synced. |
| `SYNC_ACTION_BLOCKED` | Dependency failed | Waiting on an earlier change. |
| `SYNC_ACTION_UNKNOWN` | Unsupported action type | Sync action not supported. |
| `SYNC_PAYLOAD_INVALID` | Schema validation failed | Sync data was invalid. |

### Generic

| Code | Typical cause | Organizer-facing message (example) |
|------|---------------|-----------------------------------|
| `VALIDATION_ERROR` | Field validation | Check the highlighted fields. |
| `CONFLICT` | Optimistic concurrency | Data changed; refresh and try again. |
| `INTERNAL_ERROR` | Unexpected server error | Something went wrong. Try again. |

Rules:

- Sync `failed` results use the same `error.code` shape as REST errors.
- `SyncReviewPanel` shows `message` in plain language; codes are for logging and client branching only.
- See `docs/specs/backend/backend-architecture.md` for domain error mapping rules.

## Security Baseline

MVP v1 has no login, but the API must still be defensive.

Rules:

- Validate every request body with a schema.
- Use allowlisted update fields.
- Do not trust client-calculated totals, ratings, ranking, or eligibility.
- Recompute payment summaries, leaderboard values, and rating changes server-side.
- Treat `organizationId` as a default MVP scope now; future authenticated versions should derive it from membership claims.
- Make replayable mutations idempotent.
- Do not leak stack traces, database IDs beyond public IDs, or server configuration in errors.
- Keep CORS, rate limiting, and request size limits explicit in implementation.

## Dashboard Snapshot

The live organizer dashboard should use an aggregate snapshot endpoint for efficient first render and refresh:

```text
GET /api/v1/sessions/:sessionId/dashboard
```

Purpose:

- Avoid many round trips for the primary live operating screen.
- Return a consistent session snapshot that can be written into the local store.
- Support local-first reconciliation with server metadata.

Response shape:

```json
{
  "data": {
    "session": {},
    "courts": [],
    "checkIns": [],
    "queue": {
      "lanes": [],
      "queuedMatches": []
    },
    "matches": {
      "active": [],
      "recent": []
    },
    "payments": {
      "summary": {},
      "exceptions": []
    },
    "leaderboardPreview": [],
    "sync": {
      "lastSyncedAt": "2026-06-09T00:00:00.000Z",
      "serverVersion": 12
    }
  },
  "meta": {
    "serverTime": "2026-06-09T00:00:00.000Z",
    "serverVersion": 12
  }
}
```

Rules:

- The snapshot should be optimized for the organizer dashboard, not every possible page.
- It can include denormalized display fields such as player names, team labels, wait time, and payment badges.
- It must not replace specific workflow endpoints for mutations.
- Local-first clients should merge the snapshot carefully and must not discard unsynced local actions or in-progress form input.
- `leaderboardPreview`: session-scoped top rows (`LeaderboardEntryDto[]`), default top 5 by wins, for dashboard compact display. Full page: `docs/specs/frontend/pages/leaderboard.md`.

## Core DTO Sketches

### `PlayerProfileDto`

Fields:

- `id`
- `organizationId`
- `displayName`
- `phone`
- `gender`
- `defaultSkillRating`
- `notes`
- `isActive`
- `createdAt`
- `updatedAt`

### `SessionDto`

Fields:

- `id`
- `organizationId`
- `name`
- `venueName`
- `startsAt`
- `endsAt`
- `status`
- `feeAmount`
- `currency`
- `queueMode`
- `requirePaymentBeforePlay` (reserved; MVP v1 always `false` — see `docs/specs/backend/payments.md`)
- `ratingMode`
- `createdAt`
- `updatedAt`

### `CourtDto`

Fields:

- `id`
- `sessionId`
- `name`
- `status`
- `sortOrder`
- `currentMatchId`
- `createdAt`
- `updatedAt`

### `CheckInDto`

Fields:

- `id`
- `sessionId`
- `playerProfileId`
- `playerDisplayName`
- `arrivalOrder`
- `checkedInAt`
- `queueStatus`
- `sessionSkillRating`
- `paymentStatus`
- `paymentAmountDue`
- `paymentAmountPaid`
- `paymentMethod`
- `paymentNotes`
- `suggestionExcluded` — optional; exclude from auto-suggestions when `true`
- `suggestionExcludeNote` — optional organizer note
- `createdAt`
- `updatedAt`

### `QueueSnapshotDto`

Fields:

- `lanes`: ordered `QueueLaneDto` records.
- `queuedMatches`: ordered `QueuedMatchDto` records with participants.
- `suggestion`: optional current suggestion preview; omit when `session.queueMode` is `manual`.

### `MatchDto`

Fields:

- `id`
- `sessionId`
- `courtId`
- `courtName`
- `status`
- `startedAt`
- `endedAt`
- `teamOneScore`
- `teamTwoScore`
- `outcome`
- `winningTeam`
- `ratingMode`
- `ratingApplied`
- `participants`
- `createdAt`
- `updatedAt`

Outcome semantics are defined in `docs/specs/backend/match-results-and-ratings.md`.

### `LeaderboardEntryDto`

Fields:

- `playerProfileId`
- `displayName`
- `currentRating` — club `defaultSkillRating`; same value in club and session scope responses
- `matchesPlayed` — completed with outcome `team_one_win`, `team_two_win`, `draw`, or `unscored`; excludes `cancelled`
- `wins`
- `losses`
- `draws`
- `winRate` — `wins / (wins + losses + draws)`; `null` when denominator is zero
- `attendanceCount` — club: total session check-ins; session scope: `1` when player checked in to that session

Optional display fields:

- `rank` — server may include for pre-sorted responses; client may recompute after sort change

Semantics: `docs/specs/backend/match-results-and-ratings.md`.  
UI display (W-L-D, scope tabs): `docs/specs/frontend/features/player/leaderboard-view.md`.

### `PaymentSummaryDto`

Fields:

- `expectedTotal`
- `collectedTotal` — sum of `paymentAmountPaid` for `paid` and `partial` check-ins
- `unpaidTotal`
- `waivedTotal`
- `refundedTotal` — sum of amounts on `refunded` check-ins; reduces net collected in UI
- `countsByStatus` — keys: `unpaid`, `partial`, `paid`, `waived`, `refunded`
- `currency`

Rules:

- Recompute server-side on payment PATCH and sync replay.
- Frontend payments page: `docs/specs/frontend/pages/organizer-session-payments.md`.

## Contract Testing Expectations

API contract tests should cover:

- Response envelope shape.
- Cursor pagination shape.
- Error envelope shape.
- Dashboard snapshot required sections.
- Unknown write fields are rejected or ignored according to schema policy.
- API DTOs do not expose internal-only database fields.
- Sync response shape stays aligned with `docs/specs/backend/sync-actions.md`.
