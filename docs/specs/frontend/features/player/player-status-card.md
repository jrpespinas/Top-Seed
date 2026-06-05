# PlayerStatusCard

Future version spec. Do not implement this component in MVP v1. MVP v1 is organizer-only and does not include player self-service status.

## User Job

Tell a player their current session status without requiring queue knowledge.

## Data Required

- Player display name.
- Queue status.
- Approximate wait position if available.
- Court assignment if assigned or playing.
- Optional payment status visibility.

## Child Components

- `StatusBadge`
- `PaymentBadge`
- `Card`

## Actions Emitted

- `onRefreshStatus`
- `onViewUpcomingMatch`

## Permissions

- Player can view only their own status.
- Guest can view only status tied to session link identity.

## States

- Loading status.
- Waiting.
- Assigned.
- Playing.
- Resting.
- Done.
- Removed.
- Error.

## Responsive Composition

- Mobile: current status first with large readable treatment.
- Tablet and desktop: status can sit beside history or profile summary.

## Acceptance Criteria

- Status copy is plain language.
- Speculative suggestions are not shown before organizer acceptance.
- Organizer notes are never exposed.
