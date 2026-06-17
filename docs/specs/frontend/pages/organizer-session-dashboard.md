# Organizer Session Dashboard Page

## Route

- `/organizer/sessions/:sessionId/dashboard`

## Primary User

- Organizer.

## User Goal

Run a live badminton session: courts, queue lanes, suggested matches, active matches, organizer-managed player check-ins, and payment exceptions.

This is the primary offline operating page for MVP v1.

The dashboard should behave like a digital pegboard: available players move into next-match staging lanes, then onto visible court slots, then return to `waiting` after results. The organizer must explicitly start play on court. `resting` is manual only. State rules: `docs/specs/backend/state-transitions.md`.

## Entry Points

- Opening an active session from `/organizer/sessions`.
- Redirect after creating a session.

## Data Dependencies

- Session detail.
- Courts.
- Check-ins.
- Queue lanes, queued matches, queue state, and suggestions.
- Active and recent matches.
- Payment summary.
- Local session snapshot.
- Sync outbox state.
- Connection status.

## Component Composition

- `SessionHeader`
- `SessionStatusBar`
- `PlayerPool`: composes `PlayerCheckInPanel` and `QueuePanel`. See `features/organizer/player-pool.md`.
- `CourtBoard`
- `NextQueuePanel`: composes `QueueLaneManagement`. See `features/organizer/next-queue-panel.md`.
- `ActiveMatchPanel`
- `PaymentSummaryPanel`
- `RecentMatchesPanel`
- `OfflineBanner`
- `SyncStatusBadge`
- `PlayerDetailDrawer` (overlay)
- `SyncReviewPanel` (overlay)

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
- Add queue lane.
- Add queued match to lane.
- Move queued match to court.
- Assign court.
- Start match.
- Finish match.
- Mark paid.

## Secondary Actions

- Regenerate suggestion.
- Rename queue lane.
- Delete queue lane.
- Move queued match between lanes.
- Pause court.
- Edit player rating.
- View payment details.
- Correct recent result.

## Responsive Layout

Desktop:

- Left column: `PlayerPool`, including search/add player, waiting/resting filters, ratings, wait time, and payment badges.
- Center column: `CourtBoard`, the largest area, showing all courts as spatial containers with Team A / Team B slots.
- Right column: `NextQueuePanel`, showing one or more queue lanes, multiple lined-up matches, accept suggestion, manual override, and move-to-court actions.
- Bottom/supporting row: recent matches, payment exceptions, and session leaderboard preview (top 5 by wins, W-L-D) with link to `/organizer/leaderboard?sessionId=:sessionId`.

Tablet:

- Keep `CourtBoard` and `NextQueuePanel` visible together.
- Place `PlayerPool` below or beside them depending on width.
- Keep payments and recent matches below the core pegboard.

Mobile:

- Co-primary organizer device. Prefer bottom tabs: **Now** (default) | **Next** | **Available** | **More** per `docs/specs/frontend/design-system.md`.
- Fallback stack: sync → courts → next queue → check-in → player pool → payments → recent matches.
- Do not require drag-and-drop; provide buttons for assign, swap, move to court, and remove.

## Navigation

- Payments link goes to `/organizer/sessions/:sessionId/payments`.
- Player management link goes to `/organizer/sessions/:sessionId/players`.
- History link goes to `/organizer/sessions/:sessionId/history`.

## API Endpoints

- `GET /api/v1/sessions/:sessionId/dashboard`: preferred read endpoint for initial dashboard snapshot and online refresh.
- `GET /api/v1/sessions/:sessionId`
- `GET /api/v1/sessions/:sessionId/courts`
- `GET /api/v1/sessions/:sessionId/check-ins`
- `GET /api/v1/sessions/:sessionId/queue`
- `POST /api/v1/sessions/:sessionId/queue/lanes`
- `PATCH /api/v1/sessions/:sessionId/queue/lanes/:laneId`
- `DELETE /api/v1/sessions/:sessionId/queue/lanes/:laneId`
- `POST /api/v1/sessions/:sessionId/queue/lanes/reorder`
- `POST /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId/move-to-lane`
- `POST /api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId/move-to-court`
- `POST /api/v1/sessions/:sessionId/queue/suggestions`
- `GET /api/v1/sessions/:sessionId/matches`
- `GET /api/v1/sessions/:sessionId/payments`
- `POST /api/v1/sync/actions`

## Acceptance Criteria

- Organizer can run the session without leaving the dashboard for common actions.
- Player add/check-in is performed by the organizer, not by player self-service.
- Dashboard layout follows `Available`, `Next`, and `Now` pegboard flow.
- Courts and next lined-up matches are visible at the same time on tablet and desktop.
- Organizer can add, rename, reorder, and delete queue lanes from the dashboard.
- Deleting a non-empty queue lane clearly warns that queued matches in that lane will be removed.
- Queue lane deletion never affects matches already assigned to courts.
- Organizer can choose which queued match from which lane goes to which open court.
- Organizer can complete matches as winner/loser, draw, or unscored.
- Cancelling a match is available as a distinct path from unscored completion.
- Rated sessions surface rating impact for wins and draws when available.
- Dashboard remains usable offline from local session state.
- Add player, check-in, court, queue lane, queued match, match, and payment actions save locally first.
- Pending and failed sync states are visible and recoverable.
- Dashboard remains useful when suggestions are unavailable.
- Manual override paths are visible.
- Realtime or polling updates do not erase in-progress form input.
