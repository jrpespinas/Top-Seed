# Main Entry Page

## Route

- `/`

## Primary User

- Organizer.

## User Goal

Send the organizer to the simplest useful starting point.

## Entry Points

- Direct visit to root URL.
- Browser bookmark.

## Data Dependencies

- Default organizer workspace.
- Optional most recent active session.

## Component Composition

- Minimal layout shell.
- Loading state.
- Optional simple entry actions if redirect target cannot be determined.

## Page States

- Loading workspace/session summary.
- Active session found: offer or redirect to `/organizer/sessions/:sessionId/dashboard`.
- No active session: go to `/organizer/sessions`.
- Error.

## Primary Actions

- Continue to organizer sessions.
- Resume active session when one exists.

## Responsive Layout

- Mobile, tablet, and desktop should remain simple and centered.

## Navigation

- Organizer goes to `/organizer/sessions`.
- Active session can go to `/organizer/sessions/:sessionId/dashboard`.
- Marketing homepage is deferred for MVP unless explicitly requested.

## API Endpoints

- `GET /api/v1/organizations/current`
- `GET /api/v1/sessions`

## Acceptance Criteria

- No login is required.
- Organizer can resume an active session quickly.
- No dashboard data loads on the root page.
