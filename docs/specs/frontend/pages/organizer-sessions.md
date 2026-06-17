# Organizer Sessions Page

## Route

- `/organizer/sessions`

## Primary User

- Organizer.

## User Goal

Find, create, open, or resume badminton sessions.

## Entry Points

- Root organizer entry.
- Organizer navigation.
- Return after completing or cancelling a session.

## Data Dependencies

- Default organizer workspace.
- Session list with status, date, venue, and counts.

## Component Composition

- Session list cards.
- Status filters.
- `Button` for creating a session.
- `EmptyState` when no sessions exist.

## Page States

- Loading sessions.
- No sessions.
- Sessions grouped or filtered by status.
- Error.

## Primary Actions

- Create session.
- Open active session dashboard.

## Secondary Actions

- Filter by status.
- View completed session history.

## Responsive Layout

- Mobile: single-column session cards.
- Tablet: cards in two-column layout.
- Desktop: wider list with more metadata.

## Navigation

- Create session goes to `/organizer/sessions/new`.
- Opening active session goes to `/organizer/sessions/:sessionId/dashboard`.

## API Endpoints

- `GET /api/v1/sessions`

## Acceptance Criteria

- Active sessions are easy to resume.
- Completed and cancelled sessions are visually distinct.
- Empty state prompts session creation.
- No login is required for MVP v1.
