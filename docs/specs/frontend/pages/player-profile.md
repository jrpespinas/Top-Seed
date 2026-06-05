# Player Profile Page

Future version spec. Do not implement this page in MVP v1. MVP v1 may show organizer-visible player history and leaderboard, but player-owned profiles come later.

## Route

- `/player/me`

## Primary User

- Player.

## User Goal

Review personal badminton history, current rating, attendance, and recent form.

## Entry Points

- Player status page.
- Player navigation.

## Data Dependencies

- Player profile.
- Match history.
- Rating history.
- Attendance summary.

## Component Composition

- `PlayerProfileSummary`
- `PlayerMatchHistory`
- `MetricCard`
- `MatchCard`

## Page States

- Loading profile.
- Guest or partial profile.
- Profile ready.
- No match history.
- Error.
- Permission denied.

## Primary Actions

- View match history.

## Secondary Actions

- Edit profile when account support exists.
- View leaderboard.

## Responsive Layout

- Mobile: profile summary then history.
- Tablet and desktop: summary beside history.

## Navigation

- Leaderboard link goes to `/leaderboard`.
- Active session link returns to `/session/:sessionId/status` when available.

## API Endpoints

- `GET /api/players/:playerId`
- `GET /api/players/:playerId/history`

## Acceptance Criteria

- Organizer notes are never displayed.
- Rating is labeled as internal club rating.
- Empty history explains that completed matches will appear there.
