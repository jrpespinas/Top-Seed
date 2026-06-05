# Organizer Session Payments Page

## Route

- `/organizer/sessions/:sessionId/payments`

## Primary User

- Organizer.

## User Goal

Track manual payment collection for a session and resolve unpaid players.

Payment tracking must remain usable offline from local session state.

## Entry Points

- Dashboard payment summary.
- Player row payment action.

## Data Dependencies

- Session fee and currency.
- Check-ins with payment fields.
- Payment totals and status counts.
- Local payment changes and sync outbox state.

## Component Composition

- `PaymentSummaryPanel`
- `PlayerRow`
- `PaymentBadge`
- `MetricCard`
- `FormField`
- `Select`
- `Drawer`
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading payments.
- No checked-in players.
- Payments ready.
- Filtered unpaid view.
- Payment update error.
- Offline with local payment edits.
- Pending payment sync.
- Failed payment sync.

## Primary Actions

- Mark paid.
- Mark partial.
- Waive fee.
- Edit amount and method.

## Secondary Actions

- Filter by payment status.
- Open player detail.
- Return to dashboard.

## Responsive Layout

- Mobile: status filters and card rows.
- Tablet: summary plus payment list.
- Desktop: summary beside wider list.

## Navigation

- Return to `/organizer/sessions/:sessionId/dashboard`.

## API Endpoints

- `GET /api/sessions/:sessionId/payments`
- `PATCH /api/sessions/:sessionId/check-ins/:checkInId/payment`
- `POST /api/sync/actions`

## Acceptance Criteria

- Manual payment language is used throughout.
- Unpaid and partial players are easy to find.
- Money values use shared formatting.
- Payment edits preserve input after errors.
- Payments are manually tracked by the organizer in MVP v1.
- Payment edits update local totals immediately and sync later.
