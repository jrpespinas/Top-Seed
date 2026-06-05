# Organizer Session Dashboard Page

## Route

- `/organizer/sessions/:sessionId/dashboard`

## Primary User

- Organizer.

## User Goal

Run a live badminton session: courts, queue, suggested match, active matches, organizer-managed player check-ins, and payment exceptions.

This is the primary offline operating page for MVP v1.

The dashboard should behave like a digital pegboard: available players move into a next-match staging lane, then onto visible court slots, then back to waiting/resting after results.

## Entry Points

- Opening an active session from `/organizer/sessions`.
- Redirect after creating a session.

## Data Dependencies

- Session detail.
- Courts.
- Check-ins.
- Queue state and suggestions.
- Active and recent matches.
- Payment summary.
- Local session snapshot.
- Sync outbox state.
- Connection status.

## Component Composition

- `SessionHeader`
- `SessionStatusBar`
- `PlayerPool`: composed from `PlayerCheckInPanel` and `QueuePanel`.
- `CourtBoard`
- `NextQueuePanel`: evolved from `SuggestedMatchPanel`.
- `ActiveMatchPanel`
- `PaymentSummaryPanel`
- `RecentMatchesPanel`
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading dashboard.
- No courts.
- No players checked in.
- Active dashboard.
- Completed/cancelled read-only session.
- Realtime refresh error.
- Offline with local operation available.
- Pending sync actions.
- Sync failed with recoverable actions.

## Primary Actions

- Check in player.
- Accept suggestion.
- Assign court.
- Start match.
- Finish match.
- Mark paid.

## Secondary Actions

- Regenerate suggestion.
- Pause court.
- Edit player rating.
- View payment details.
- Correct recent result.

## Responsive Layout

Desktop:

- Left column: `PlayerPool`, including search/add player, waiting/resting filters, ratings, wait time, and payment badges.
- Center column: `CourtBoard`, the largest area, showing all courts as spatial containers with Team A / Team B slots.
- Right column: `NextQueuePanel`, showing multiple lined-up matches, auto-fill, manual override, and move-to-court actions.
- Bottom/supporting row: recent matches, payment exceptions, and leaderboard shortcut.

Tablet:

- Keep `CourtBoard` and `NextQueuePanel` visible together.
- Place `PlayerPool` below or beside them depending on width.
- Keep payments and recent matches below the core pegboard.

Mobile:

- Stack by urgency: offline/sync state, next queue, courts, quick add/check-in, player pool, payments, recent matches.
- Do not require drag-and-drop; provide buttons for assign, swap, move to court, and remove.

## Navigation

- Payments link goes to `/organizer/sessions/:sessionId/payments`.
- Player management link goes to `/organizer/sessions/:sessionId/players`.
- History link goes to `/organizer/sessions/:sessionId/history`.

## API Endpoints

- `GET /api/sessions/:sessionId`
- `GET /api/sessions/:sessionId/courts`
- `GET /api/sessions/:sessionId/check-ins`
- `GET /api/sessions/:sessionId/queue`
- `POST /api/sessions/:sessionId/queue/suggestions`
- `GET /api/sessions/:sessionId/matches`
- `GET /api/sessions/:sessionId/payments`
- `POST /api/sync/actions`

## Acceptance Criteria

- Organizer can run the session without leaving the dashboard for common actions.
- Player add/check-in is performed by the organizer, not by player self-service.
- Dashboard layout follows `Available`, `Next`, and `Now` pegboard flow.
- Courts and next lined-up matches are visible at the same time on tablet and desktop.
- Dashboard remains usable offline from local session state.
- Add player, check-in, court, queue, match, and payment actions save locally first.
- Pending and failed sync states are visible and recoverable.
- Dashboard remains useful when suggestions are unavailable.
- Manual override paths are visible.
- Realtime or polling updates do not erase in-progress form input.
