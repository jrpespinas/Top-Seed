# SessionStatusBar

## User Job

Show the organizer the live health of a badminton session through operational metrics.

## Data Required

- Checked-in player count.
- Waiting player count.
- Active match count.
- Open court count.
- Unpaid player count.
- Collected amount.

## Child Components

- `MetricCard`
- `PaymentBadge`

## Actions Emitted

- `onFilterWaiting`
- `onFilterUnpaid`
- `onViewCourts`
- `onViewPayments`

## Permissions

- Payment totals visible to organizers only.

## States

- Loading metrics.
- Ready.
- Realtime updating.
- Empty session metrics.

## Responsive Composition

- Mobile: horizontal scroll of compact `MetricCard` components.
- Tablet: single-row status bar when space allows.
- Desktop: can show descriptions under metric labels.

## Acceptance Criteria

- Unpaid count is never hidden from organizers.
- Each interactive metric filters or navigates to relevant detail.
- Metrics do not introduce vanity analytics.
