# Organizer Session Payments Page

## Route

- `/organizer/sessions/:sessionId/payments`

## Primary User

- Organizer.

## User Goal

Track **manual** payment collection for one session: see who owes what, record cash or transfer payments, waive fees, handle refunds, and fix mistakes — without leaving the courtside workflow.

Payment tracking is **informational only** in MVP v1. It does not block queueing or play. See `docs/specs/backend/payments.md`.

Payment changes must work offline: save locally first, update totals immediately, sync via `UPDATE_PAYMENT`.

## Relationship to Dashboard

| Surface | Role |
|---------|------|
| `PaymentSummaryPanel` on dashboard | At-a-glance totals + unpaid preview; link to this page |
| **This page** | Full player payment list, filters, and all status actions |
| `PlayerDetailDrawer` | Same payment actions for one player without opening this page |

## Entry Points

- `PaymentSummaryPanel` → `View all` / `onOpenPayments`
- Dashboard unpaid exception row
- `PlayerRow` payment badge or payment action
- Session navigation

## Data Dependencies

- Session fee and `currency`
- Check-ins with payment fields (`paymentStatus`, amounts, method, notes)
- `PaymentSummaryDto` totals and `countsByStatus`
- Local payment edits and sync outbox state

## Component Composition

- `PaymentSummaryPanel` (full totals on this page)
- Filter bar (`Tabs` or `Select` by status)
- Payment list: `PlayerRow` + `PaymentBadge` per check-in
- Inline or drawer edit: `FormField`, `Select` for method and amounts
- `MetricCard` for summary tiles when layout uses them
- `PlayerDetailDrawer` (optional overlay for player context)
- `ConfirmAction` for refund and reset
- `OfflineBanner`
- `SyncStatusBadge`

## Payment Statuses

All five statuses from `docs/specs/backend/payments.md`:

| Status | Meaning | Primary organizer action |
|--------|---------|--------------------------|
| `unpaid` | Owes full session fee | Mark paid, Mark partial, Waive |
| `partial` | Paid less than due | Mark paid, edit amount, Waive |
| `paid` | Paid amount due | Mark refunded, Reset to unpaid |
| `waived` | Fee intentionally waived | Reset to unpaid |
| `refunded` | Cash returned **outside** the app after a prior payment | Reset to unpaid |

## Primary Actions (by current status)

### From `unpaid` or `partial`

- **Mark paid** — sets `paymentStatus: paid`, `paymentAmountPaid` to amount due (editable before save).
- **Mark partial** — opens amount + method; sets `partial` when `0 < paid < due`.
- **Waive fee** — sets `waived`, amount paid may be `0`.
- **Edit amount / method / notes** — inline or drawer fields.

### From `paid` or `partial` (after real payment)

- **Mark refunded** — cash was returned offline; sets `refunded`, preserves prior amount/method in `paymentNotes` when useful. Requires confirmation.

Recommended confirmation copy:

```text
Mark Ana as refunded?
Use this when you returned their payment outside the app. Collected total will decrease.
```

### Correction (mistaken status)

- **Reset to unpaid** — undo a mistaken mark paid / partial / waived / refunded. Sets `unpaid`, clears or resets `paymentAmountPaid` to `0`. Requires lightweight confirmation. Do **not** use for real cash returns — use **Mark refunded**.

## Secondary Actions

- Filter by status: All, Unpaid, Partial, Paid, Waived, Refunded.
- Sort by name or status (default: unpaid first).
- Open `PlayerDetailDrawer` from a row.
- Return to dashboard.

## Session Totals (`PaymentSummaryDto`)

Display on this page via `PaymentSummaryPanel`:

| Total | Rule |
|-------|------|
| **Expected** | Sum of `paymentAmountDue` for active check-ins |
| **Collected** | Sum of `paymentAmountPaid` for `paid` and `partial` only |
| **Unpaid** | Sum still owed from `unpaid` and `partial` |
| **Waived** | Sum of fees waived (`waived`) |
| **Refunded** | Sum of amounts on `refunded` rows (money returned) |

Rules:

- **Mark refunded** moves a player to `refunded` and **reduces Collected** by the refunded amount (or excludes that row from collected going forward).
- `countsByStatus` shows count per status including `refunded`.
- Use shared currency formatting.

## Page States

- Loading payments.
- No checked-in players.
- Payments ready.
- Filtered view (unpaid, partial, paid, waived, refunded).
- Payment update in progress.
- Payment update error (preserve form input).
- Offline with local payment edits.
- Pending payment sync on one or more rows.
- Failed payment sync (retry via sync review).

## Session Mode

See `docs/specs/mvp-access.md`.

- Live session: all payment actions enabled.
- `completed` or `cancelled`: read-only payment list and totals; hide mark paid / refund / reset.

## Responsive Layout

- **Mobile**: summary cards on top; status filter chips; one player per card row with primary action visible.
- **Tablet**: summary row + scrollable list.
- **Desktop**: summary beside wider list; optional second column for edit drawer.

## Navigation

- Return to `/organizer/sessions/:sessionId/dashboard`.
- Deep link: `/organizer/sessions/:sessionId/payments?status=unpaid` for unpaid filter.

## API Endpoints

- `GET /api/v1/sessions/:sessionId/payments` — summary + check-in payment rows
- `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId/payment`
- `POST /api/v1/sync/actions` — `UPDATE_PAYMENT` when offline

## Acceptance Criteria

- Manual payment language throughout (`Mark paid`, not `Charge`).
- All five statuses are actionable with the rules above.
- **Mark refunded** is available for `paid` and `partial`; not shown for `unpaid`.
- **Reset to unpaid** is available for corrections; distinct copy from refund.
- Unpaid and partial players are easy to find (filter + default sort).
- Refunded total appears in summary and reduces collected appropriately.
- Money values use shared formatting.
- Payment edits preserve input after errors.
- Payment edits update local totals immediately and sync later.
- Payment does not gate queueing or court assignment in MVP v1.
