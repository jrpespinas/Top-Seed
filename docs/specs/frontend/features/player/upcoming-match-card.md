# UpcomingMatchCard

Future version spec. Do not implement this component in MVP v1. MVP v1 keeps upcoming match assignment inside organizer-operated dashboard views.

## User Job

Show a player their accepted upcoming or active match assignment.

## Data Required

- Court name.
- Match status.
- Partner.
- Opponents.
- Start time if available.

## Child Components

- `MatchCard`
- `StatusBadge`

## Actions Emitted

- `onViewMatchDetails`

## Permissions

- Player can view only published assignments relevant to them.

## States

- No upcoming match.
- Assigned.
- In progress.
- Completed.
- Error.

## Responsive Composition

- Mobile: court and partner first.
- Tablet and desktop: show full team pairing.

## Acceptance Criteria

- Does not show unaccepted queue suggestions.
- Team roles are clear: partner versus opponents.
- Court name is prominent.
