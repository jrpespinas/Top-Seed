# Player Check-In Page

Future version spec. Do not implement this page in MVP v1. MVP v1 uses organizer-managed player add/check-in from the organizer dashboard and players page.

## Route

- `/session/:sessionId/check-in`

## Primary User

- Player or guest.

## User Goal

Join a badminton session from a QR code or shared link without needing organizer help.

## Entry Points

- QR code at venue.
- Shared session link.
- Redirect from main entry with session context.

## Data Dependencies

- Public session summary.
- Existing player search or match results if supported.
- Check-in status for duplicate prevention.

## Component Composition

- Check-in form.
- `SearchInput`
- `FormField`
- `Button`
- `EmptyState`
- Optional returning player result rows.

## Page States

- Loading session.
- Session open for check-in.
- Session closed.
- Already checked in.
- Check-in submitted.
- Error.

## Primary Actions

- Check in as returning player.
- Create guest player and check in.

## Secondary Actions

- Clear search.
- Ask organizer for help through provided venue instructions if added.

## Responsive Layout

- Mobile: single-column form with large submit action.
- Tablet and desktop: centered narrow form.

## Navigation

- Successful check-in goes to `/session/:sessionId/status`.

## API Endpoints

- `GET /api/sessions/:sessionId`
- `GET /api/players`
- `POST /api/sessions/:sessionId/check-ins`

## Acceptance Criteria

- Full account creation is not required.
- Duplicate check-in is explained.
- Organizer-only payment controls are not shown.
