# PlayerCheckInPanel

## User Job

Let the organizer add returning players or walk-ins to the current session quickly.

MVP v1 check-in is organizer-managed only. Players do not self-check-in from a QR or shared link.

## Data Required

- Session id and fee.
- Player search results.
- Default rating.
- Existing active check-ins for duplicate prevention.
- Local player/check-in sync status.

## Child Components

- `SearchInput`
- `PlayerRow`
- `FormField`
- `Select`
- `Button`
- `Drawer`
- `PaymentBadge`
- `SyncStatusBadge`

## Actions Emitted

- `onSearchPlayer`
- `onCreatePlayer`
- `onCheckInPlayer`
- `onSetPaymentStatus`

## Permissions

- MVP v1 has no login or role checks. Keep actions structured so organizer permissions can be added later.

## States

- Search empty.
- Searching.
- Returning player results.
- No results.
- Creating walk-in.
- Checking in.
- Duplicate already checked-in warning.
- Error.
- Offline with local player or check-in pending sync.

## Responsive Composition

- Mobile: drawer or full-width form.
- Tablet: panel can stay open beside queue.
- Desktop: search and quick-add can show together.

## Acceptance Criteria

- Returning players can be checked in in a few taps.
- New players default to rating `3.0`.
- Duplicate check-ins are blocked and explained.
- No player-facing check-in controls are required for MVP v1.
- Player creation and check-in write locally first and remain available after reload.
