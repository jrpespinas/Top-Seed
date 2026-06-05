# PaymentSummaryPanel

## User Job

Help the organizer understand collection status and quickly find unpaid players.

## Data Required

- Expected total.
- Collected total.
- Unpaid total.
- Waived total.
- Count by payment status.
- Unpaid or partial player list preview.
- Payment sync status and pending payment action count.

## Child Components

- `MetricCard`
- `PaymentBadge`
- `PlayerRow`
- `Button`
- `SyncStatusBadge`

## Actions Emitted

- `onFilterUnpaid`
- `onOpenPayments`
- `onMarkPaid`

## Permissions

- Visible to organizers only.

## States

- Loading payments.
- No checked-in players.
- Payments ready.
- Unpaid warning.
- Update error.
- Offline with local pending payment changes.
- Sync failed for one or more payment actions.

## Responsive Composition

- Mobile: show unpaid count and link to payment page.
- Tablet: show totals and unpaid preview.
- Desktop: show more status breakdown.

## Acceptance Criteria

- Uses manual payment language.
- Unpaid and partial players are easy to spot.
- Totals use shared money formatting.
- Payment totals update immediately from local state while offline.
- Pending payment updates are visible and retryable if sync fails.
