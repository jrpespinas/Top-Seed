# Backend Domain Model Spec

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

### Match

Represents one badminton match assignment and result.

Required fields:

- `id`
- `sessionId`
- `courtId`
- `status`
- `startedAt`
- `endedAt`
- `teamOneScore`
- `teamTwoScore`
- `winningTeam`
- `createdAt`
- `updatedAt`

Future fields:

- `createdByUserId`: optional link to the authenticated organizer who assigned or recorded the match.

Allowed statuses:

- `assigned`
- `in_progress`
- `completed`
- `cancelled`

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
- `reason`
- `createdAt`

### SyncAction

Represents one locally queued mutation waiting to sync with the backend.

Required local fields:

- `id`: client-generated action ID.
- `type`: action type, such as `CHECK_IN_PLAYER`, `MARK_PAID`, `ASSIGN_COURT`, or `COMPLETE_MATCH`.
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

- Sync actions must be idempotent.
- Sync actions should be applied in creation order for a session unless the action type is explicitly independent.
- Failed actions remain visible and retryable by the organizer.
- Synced actions can be retained locally for audit/debugging or compacted after a safe retention window.

## Invariants

- `CheckIn.sessionId` and `Court.sessionId` must match the `Match.sessionId` for any match assignment.
- A player cannot be assigned to two active matches in the same session.
- A court cannot have two active matches at the same time.
- `PaymentRecord` can be embedded in `CheckIn` for MVP. Extract it only when partial payment history becomes necessary.
- Rating updates happen only after match completion or explicit organizer adjustment.
- Offline-created actions must not violate the same invariants when replayed during sync.
