# Player Session Status Page

Future version spec. Do not implement this page in MVP v1. MVP v1 is organizer-only; players do not have self-service status or upcoming-match pages yet.

## Route

- `/session/:sessionId/status`

## Primary User

- Checked-in player or guest.

## User Goal

Know current session status, upcoming match, and next relevant action.

## Entry Points

- Redirect after check-in.
- Player refreshes shared status link.

## Data Dependencies

- Player check-in.
- Session summary.
- Accepted upcoming or active match.
- Recent player match summary.

## Component Composition

- `PlayerStatusCard`
- `UpcomingMatchCard`
- `PlayerMatchHistory` summary.
- Link to `LeaderboardView`.

## Page States

- Loading status.
- Waiting.
- Assigned.
- Playing.
- Resting.
- Done.
- Removed.
- Session completed.
- Error.

## Primary Actions

- Refresh status.
- View upcoming match detail when available.

## Secondary Actions

- View history.
- View leaderboard.

## Responsive Layout

- Mobile: current status and upcoming match first.
- Tablet and desktop: status beside recent history.

## Navigation

- History goes to `/player/me`.
- Leaderboard goes to `/leaderboard`.

## API Endpoints

- `GET /api/v1/sessions/:sessionId`
- `GET /api/v1/sessions/:sessionId/check-ins`
- `GET /api/v1/sessions/:sessionId/matches`

## Acceptance Criteria

- Player never sees speculative unaccepted suggestions.
- Court, partner, and opponents are clear once assigned.
- Status is understandable without knowing queue rules.
