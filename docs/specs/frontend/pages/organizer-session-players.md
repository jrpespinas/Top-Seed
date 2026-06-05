# Organizer Session Players Page

## Route

- `/organizer/sessions/:sessionId/players`

## Primary User

- Organizer.

## User Goal

Manually add, check in, and manage players for the session.

Player management must remain usable offline for the active session.

## Entry Points

- Dashboard player management link.
- Queue panel detail action.

## Data Dependencies

- Session detail.
- Check-ins.
- Player profiles.
- Session ratings.
- Payment status.
- Match counts.
- Local player/check-in changes and sync status.

## Component Composition

- `PlayerCheckInPanel`
- `QueuePanel`
- `PlayerRow`
- `SearchInput`
- `Drawer`
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading players.
- No checked-in players.
- Players ready.
- Search no results.
- Update error.
- Offline with local player/check-in edits.
- Pending player/check-in sync.
- Failed sync for a player action.

## Primary Actions

- Check in player.
- Edit session rating.
- Mark done or restore.
- Remove player from session.

## Secondary Actions

- Search players.
- View player details.
- Update payment status when surfaced from row detail.

## Responsive Layout

- Mobile: search and list first, details in drawer.
- Tablet: list and detail drawer.
- Desktop: wider list with filters.

## Navigation

- Return to dashboard after primary player operations if entered from dashboard.

## API Endpoints

- `GET /api/sessions/:sessionId/check-ins`
- `POST /api/sessions/:sessionId/check-ins`
- `PATCH /api/sessions/:sessionId/check-ins/:checkInId`
- `POST /api/sessions/:sessionId/check-ins/:checkInId/remove`
- `POST /api/sessions/:sessionId/check-ins/:checkInId/restore`
- `GET /api/players`
- `POST /api/players`
- `POST /api/sync/actions`

## Acceptance Criteria

- Duplicate active check-ins are prevented.
- Payment and queue status are visible for each player.
- Long lists remain usable on mobile.
- Player self-service check-in is not part of MVP v1.
- Add, edit, and check-in actions save locally first and sync later.
