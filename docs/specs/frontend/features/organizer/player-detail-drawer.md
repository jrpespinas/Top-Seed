# PlayerDetailDrawer

## User Job

Let the organizer inspect and update one player's **session state** and **club profile** without leaving the live dashboard or players list.

Opens from queue rows, payment rows, leaderboard rows, and the players page.

## Data Required

### This session (check-in scoped)

- `checkInId`, `sessionId`
- `queueStatus`, wait time, matches played this session
- `suggestionExcluded`, `suggestionExcludeNote`
- `sessionSkillRating`
- `paymentStatus`, `paymentAmountDue`, `paymentAmountPaid`, `paymentMethod`, `paymentNotes`
- Per-check-in sync status

### Player profile (organization scoped)

- `playerProfileId`
- `displayName`, `phone`
- `gender` (optional organizer metadata)
- `defaultSkillRating` (club rating)
- `notes` (optional organizer notes)
- Profile sync status when profile was just created or edited

## Child Components

- `Drawer`
- `DataList`
- `FormField`
- `Select`
- `Button`
- `StatusBadge`
- `PaymentBadge`
- `SyncStatusBadge`
- `ConfirmAction` (for remove from session)

## Layout

Use one drawer with two labeled sections (headings, not separate routes):

### Section 1 — This session

Read-only via `DataList` where appropriate:

- Queue status
- Wait time
- Session record (**W-L-D** and win % for this session)
- Matches played (session)
- Payment summary

Editable:

- Session skill rating
- Payment status and amounts (same actions as payments page: paid, partial, waive, refunded, reset to unpaid)
- Queue quick actions: `Back to waiting`, `Mark resting`, `Mark done`, `Remove from session` (disabled while `playing`)
- Skip suggestions / clear skip (same as `QueuePanel`)

### Section 2 — Player profile

Editable:

- Display name
- Phone
- Gender (optional; see Gender field)
- Club rating (`defaultSkillRating`, one decimal, clamped `1.0`–`5.0`)
- Organizer notes (optional textarea)

Rules:

- Profile edits use `UPDATE_PLAYER_PROFILE` / player API.
- Session edits use check-in / payment sync actions.
- Show `SyncStatusBadge` on the section affected by a pending or failed mutation.
- One drawer, two sections — organizer may save session and profile changes independently (section-level save or single save footer; either is acceptable if unsaved state is clear).

### Field ownership (canonical)

| Field | Section | Editable here |
|-------|---------|---------------|
| Queue status, wait, session W-L-D | This session | Read-only display |
| Session skill rating | This session | Yes |
| Payment | This session | Yes |
| Queue quick actions | This session | Yes |
| `displayName`, `phone` | Player profile | Yes |
| `gender` | Player profile | Yes (optional) |
| `defaultSkillRating` | Player profile | Yes |
| Organizer `notes` | Player profile | Yes |

Do not duplicate these fields as inline editors on `PlayerRow` in queue or players lists.

### Gender field

Optional organizer metadata. Not used for queueing in MVP.

Allowed UI values:

- Not set (default for new walk-ins if unknown)
- Male
- Female
- Other
- Prefer not to say

Store as organizer-managed profile field per `docs/specs/backend/domain-model.md`. Do not require gender to check in or queue.

## Actions Emitted

- `onUpdateSessionRating`
- `onUpdatePayment`
- `onUpdateQueueStatus`
- `onRemoveFromSession`
- `onUpdatePlayerProfile`
- `onClose`

## Session Mode

See `docs/specs/mvp-access.md`.

- Available in live sessions for edit actions.
- Ended sessions: read-only drawer; hide mutation actions.

## States

- Loading player and check-in.
- Ready.
- Saving session fields.
- Saving profile fields.
- Validation error (preserve entered values).
- Player is `playing` (disable queue remove/done; show short explanation).
- Offline with local pending edits.
- Sync failed for profile or check-in mutation.

## Responsive Composition

- Mobile: bottom sheet drawer; sticky footer with `Save` / `Close`.
- Tablet and desktop: right-side drawer; keep dashboard context visible.

## Entry Points

- `QueuePanel` → `onOpenPlayerDetails`
- `organizer-session-payments` → open from payment row
- `organizer-session-players` → open from player row
- `LeaderboardView` → `onViewPlayer`
- Optional from `PlayerRow` on court or queue cards (view only or full edit per context)

## Acceptance Criteria

- Organizer sees both **This session** and **Player profile** in one drawer.
- Session payment and queue changes write locally first and show sync status.
- Profile name, phone, gender, club rating, and notes persist via `UPDATE_PLAYER_PROFILE`.
- Gender is optional and does not block check-in or suggestions.
- Removing a player from session requires confirmation and is blocked while `playing`.
- Drawer works offline for local-first mutations.
- Long names and notes wrap without breaking layout.
