# PaymentSummaryPanel

## User Job

Help the organizer understand collection status and quickly find unpaid players.

Used on the **live dashboard** (compact) and the **session payments page** (full totals).

## Data Required

- `expectedTotal`
- `collectedTotal`
- `unpaidTotal`
- `waivedTotal`
- `refundedTotal`
- `countsByStatus` — including `unpaid`, `partial`, `paid`, `waived`, `refunded`
- `currency`
- Unpaid or partial player list preview (dashboard compact mode)
- Payment sync status and pending payment action count

## Child Components

- `MetricCard`
- `PaymentBadge`
- `PlayerRow`
- `Button`
- `SyncStatusBadge`

## Actions Emitted

- `onFilterUnpaid`
- `onOpenPayments` — navigate to `/organizer/sessions/:sessionId/payments`
- `onMarkPaid` — quick action from dashboard preview row only

## Permissions

MVP v1: organizer-only.

## States

- Loading payments.
- No checked-in players.
- Payments ready.
- Unpaid warning (non-zero `unpaidTotal` or partial count).
- Update error.
- Offline with local pending payment changes.
- Sync failed for one or more payment actions.

## Responsive Composition

- **Mobile (dashboard)**: unpaid count + `View all` link to payments page.
- **Tablet (dashboard)**: totals + unpaid preview (top 3–5 rows).
- **Desktop (dashboard)**: fuller status breakdown.
- **Payments page**: show all summary metrics including **Refunded**.

## Copy Guidelines

- **Collected** — money received (`paid` + `partial` amounts).
- **Refunded** — money returned outside the app; reduces collected view.
- Link label: `View all payments` or `Payment details`.

## Acceptance Criteria

- Uses manual payment language.
- Shows `refundedTotal` and refunded count when non-zero.
- Unpaid and partial players are easy to spot on dashboard.
- Totals use shared money formatting and update immediately from local state while offline.
- Pending payment updates are visible and retryable if sync fails.
- Full payment actions (refund, reset, waive) live on the payments page or `PlayerDetailDrawer`, not required on dashboard compact preview.
