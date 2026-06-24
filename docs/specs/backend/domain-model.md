# Backend Domain Model Spec

State transition rules for players, queued matches, court matches, courts, and sessions are defined in `docs/specs/backend/state-transitions.md`.

## Principles

- Model real badminton session operations directly.
- Keep session data separate from global player data.
- Prefer explicit state fields over inferring live state from timestamps.
- Keep all organizer actions auditable enough to explain what happened during a session.
- Support local-first MVP operation: organizer actions may be created offline and synced later.

## Local-First Metadata

Locally mutable MVP entities should support sync metadata either directly or through local-only client records:

- `clientId`: client-generated stable ID used before server persistence.
- `syncStatus`: `local`, `pending`, `syncing`, `synced`, or `failed`.
- `lastSyncedAt`: last successful server acknowledgement timestamp.
- `updatedAt`: updated whenever local or server state changes.
- `lastSyncError`: optional local-only error message for recoverable sync failures.

Server-persisted records should accept client-generated IDs or idempotency keys for mutations that may be replayed after disconnection.

Implementation note:

- `syncStatus`, `lastSyncedAt`, `lastSyncError`, and retry state are client outbox metadata for MVP.
- Server tables should not add `syncStatus` columns to every domain entity.
- Server persistence should store enough idempotency data to detect already-applied actions and return canonical IDs during sync acknowledgement.

## Core Entities

### Organization

Represents a club, group, venue, or organizer workspace. In MVP v1 this can be a single local/default workspace without login.

Required fields:

- `id`
- `name`
- `timezone`
- `createdAt`
- `updatedAt`

Relationships:

- Has many `playerProfiles`.
- Has many `sessions`.
- Has many `users` in future authenticated versions.

### User

Future-version entity. Represents an authenticated identity once login, organizations, and player accounts are added. Do not require `User` for MVP v1.

Required fields:

- `id`
- `email`
- `displayName`
- `role`
- `organizationId`
- `createdAt`
- `updatedAt`

Allowed roles:

- `owner`
- `organizer`
- `player`

### PlayerProfile

Represents a badminton player known to the organizer workspace. In MVP v1, all player profiles are organizer-managed records and do not require login accounts.

Required fields:

- `id`
- `organizationId`
- `displayName`
- `phone`
- `defaultSkillRating`
- `notes`
- `isActive`
- `createdAt`
- `updatedAt`

Optional MVP fields:

- `gender`: organizer-managed metadata. Do not use as a queueing rule unless a future spec explicitly adds gender-aware matching.

Future fields:

- `userId`: optional link to an authenticated player account.

MVP rating recommendation:

- Use a numeric scale from `1.0` to `5.0`.
- Allow one decimal place.
- Default new players to `3.0` unless organizer chooses otherwise.

### Session

Represents one badminton event.

Required fields:

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
- `requirePaymentBeforePlay` (reserved; MVP v1 always `false` — payment does not gate play; see `docs/specs/backend/payments.md`)
- `ratingMode`
- `createdAt`
- `updatedAt`

Future fields:

- `createdByUserId`: optional link to the authenticated organizer who created the session.

Allowed statuses:

- `draft`
- `open`
- `active`
- `completed`
- `cancelled`

Allowed queue modes:

- `suggested` — show match suggestions and scoring helpers (MVP default).
- `manual` — hide automatic suggestions; organizer stages matches manually in Next lanes and courts.

Rules:

- `queueMode` does not remove queue lanes or pegboard staging; it only controls whether the suggestion engine is active.
- Changing `queueMode` mid-session is allowed; UI should refresh suggestion visibility immediately.

MVP defaults:

- `queueMode`: `suggested`.
- `requirePaymentBeforePlay`: `false` (fixed in MVP v1; no payment gate before play).
- `ratingMode`: `casual`.

Allowed rating modes:

- `casual`
- `rated`

Session lifecycle transitions: `docs/specs/backend/state-transitions.md`.

### Court

Represents a playable court within a session.

Required fields:

- `id`
- `sessionId`
- `name`
- `status`
- `sortOrder`
- `createdAt`
- `updatedAt`

Allowed statuses:

- `open`
- `occupied`
- `paused`
- `unavailable`

Court status transitions: `docs/specs/backend/state-transitions.md`.

### QueueLane

Represents one organizer-managed staging lane for upcoming matches in a session.

MVP v1 lanes are generic and flexible. They are not required to represent skill level, court binding, or player-visible queues.

Required fields:

- `id`
- `sessionId`
- `name`
- `status`
- `sortOrder`
- `createdAt`
- `updatedAt`

Allowed statuses:

- `active`
- `archived`

Rules:

- Every active session should have at least one active queue lane.
- A queue lane can be renamed and reordered.
- Deleting a queue lane removes queued matches still staged inside that lane after organizer confirmation.
- Deleting a queue lane must not affect matches already assigned to courts.

### QueuedMatch

Represents a staged upcoming match before it is moved onto a court.

Queued matches support the pegboard `Next` area. They become normal `Match` records only when assigned to a court.

Required fields:

- `id`
- `sessionId`
- `queueLaneId`
- `status`
- `sortOrder`
- `createdFrom`
- `createdAt`
- `updatedAt`

Allowed statuses:

- `draft`
- `ready`
- `removed`
- `promoted`

Allowed `createdFrom` values:

- `manual`
- `suggestion`

Deprecated (do not emit in new clients): `auto_fill` — treat as `suggestion` if received from legacy data.

Rules:

- A ready queued match must have enough participants for the selected match format before it can be moved to a court.
- Moving a queued match to a court creates a `Match` and marks the queued match `promoted`.
- Removing a queued match must not delete any player profile, check-in, or completed match history.

Queued match status transitions: `docs/specs/backend/state-transitions.md`.

### QueuedMatchParticipant

Represents one player slot in a staged upcoming match.

Required fields:

- `id`
- `queuedMatchId`
- `playerProfileId`
- `checkInId`
- `team`
- `slotOrder`

Allowed teams:

- `team_one`
- `team_two`

Rules:

- Team structure should be preserved when a queued match is promoted to a court match.
- Incomplete queued matches can have empty UI slots, but persisted participant rows should represent selected players only.

### CheckIn

Represents a player's presence and session-specific state.

Required fields:

- `id`
- `sessionId`
- `playerProfileId`
- `arrivalOrder`
- `checkedInAt`
- `queueStatus`
- `sessionSkillRating`
- `paymentStatus`
- `paymentAmountDue`
- `paymentAmountPaid`
- `paymentMethod`
- `paymentNotes`
- `createdAt`
- `updatedAt`

Optional MVP fields:

- `suggestionExcluded`: when `true`, exclude this check-in from match suggestions while `queueStatus` remains `waiting` or `resting`.
- `suggestionExcludeNote`: optional organizer note explaining why (for example `Playing doubles with guest` or `Let others play first`).

Allowed queue statuses:

- `waiting`
- `assigned`
- `playing`
- `resting`
- `done`
- `removed`

Allowed payment statuses:

- `unpaid`
- `paid`
- `partial`
- `waived`
- `refunded`

Player queue status transitions: `docs/specs/backend/state-transitions.md`.

### Match

Represents one badminton match assignment and result.

Match result semantics, rating effects, leaderboard effects, and correction behavior are defined in `docs/specs/backend/match-results-and-ratings.md`.

Required fields:

- `id`
- `sessionId`
- `status`
- `startedAt`
- `endedAt`
- `teamOneScore`
- `teamTwoScore`
- `outcome`
- `winningTeam`
- `createdAt`
- `updatedAt`

Optional fields:

- `courtId` — required while a match is `assigned` or `in_progress` on a live court. May be `null` after the court is deleted; historical match records keep teams and results without a court reference.

Future fields:

- `createdByUserId`: optional link to the authenticated organizer who assigned or recorded the match.

Allowed statuses:

- `assigned`
- `in_progress`
- `completed`
- `cancelled`

Allowed outcomes:

- `team_one_win`
- `team_two_win`
- `draw`
- `unscored`

Match status transitions: `docs/specs/backend/state-transitions.md`.

### MatchParticipant

Represents one player in one match.

Required fields:

- `id`
- `matchId`
- `playerProfileId`
- `checkInId`
- `team`
- `ratingBefore`
- `ratingAfter`
- `ratingDelta`

Allowed teams:

- `team_one`
- `team_two`

### RatingHistory

Stores rating changes caused by completed matches or organizer corrections.

Required fields:

- `id`
- `playerProfileId`
- `sessionId`
- `matchId`
- `ratingBefore`
- `ratingAfter`
- `ratingDelta`
- `reason`
- `createdAt`

Allowed reasons:

- `match_completed`
- `draw_completed`
- `result_corrected`
- `organizer_adjustment`

### SyncAction

Represents one locally queued mutation waiting to sync with the backend.

Required local fields:

- `id`: client-generated action ID.
- `organizationId`
- `deviceId`
- `sessionId`: required for session-scoped actions.
- `type`: action type from `docs/specs/backend/sync-actions.md`.
- `entityType`
- `entityId`
- `payload`
- `createdAt`
- `status`
- `retryCount`
- `lastError`

Allowed statuses:

- `pending`
- `syncing`
- `synced`
- `failed`

Rules:

- Sync actions must follow the canonical catalog in `docs/specs/backend/sync-actions.md`.
- Sync actions must be idempotent by `organizationId`, `deviceId`, and `id`.
- Sync actions should be applied in creation order for a session unless the action type is explicitly independent.
- Failed dependencies should block later dependent actions, but unrelated actions can continue when safe.
- Failed actions remain visible and retryable by the organizer.
- Synced actions can be retained locally for audit/debugging or compacted after a safe retention window.

## Invariants

Canonical list: `docs/specs/backend/state-transitions.md`.

- `QueueLane.sessionId`, `QueuedMatch.sessionId`, `CheckIn.sessionId`, and `Court.sessionId` must match the `Match.sessionId` for any match assignment or promotion.
- A player cannot be on two active court matches (`assigned` or `in_progress`) in the same session.
- A player may appear in multiple `draft` or `ready` queued matches in the same session for future matchup planning.
- A court cannot have two active matches at the same time.
- An active session must keep at least one active queue lane.
- `resting` is organizer-initiated only; match completion must not auto-apply `resting`.
- `PaymentRecord` can be embedded in `CheckIn` for MVP. Extract it only when partial payment history becomes necessary.
- Rating updates happen only after match completion or explicit organizer adjustment.
- Offline-created actions must not violate the same invariants when replayed during sync.
