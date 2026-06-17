# Manual Payments Spec

## Product Goal

Payment tracking in the MVP should help the organizer know who has paid for a badminton session and how much money should be collected. It is not an online payment system.

Manual payment tracking must work offline during a live session. Payment changes should save locally first, appear immediately in the organizer UI, and sync when connectivity returns.

## MVP Scope

In scope:

- Session fee configuration.
- Per-player payment status.
- Amount due and amount paid.
- Payment method note.
- Organizer notes.
- Session-level payment summary.

Out of scope:

- Payment gateway integration.
- In-app card payments.
- Refund processing through providers.
- Receipts and invoices.
- Accounting exports.
- Wallets, credits, or stored balances.

## Payment State

Payment state belongs to `CheckIn`, because payment is specific to one session.

Allowed statuses:

- `unpaid`: player owes the full session fee.
- `partial`: player paid less than the amount due.
- `paid`: player paid the amount due.
- `waived`: organizer intentionally waived the fee.
- `refunded`: organizer marked the payment as returned outside the system.

## Required Fields

Store these fields on the session check-in for MVP:

- `paymentStatus`
- `paymentAmountDue`
- `paymentAmountPaid`
- `paymentMethod`
- `paymentNotes`
- `paymentUpdatedByUserId`
- `paymentUpdatedAt`

Suggested payment methods:

- `cash`
- `bank_transfer`
- `gcash`
- `maya`
- `other`
- `none`

## Organizer Workflows

The organizer should be able to:

- Mark one player as paid from the live dashboard or payments page.
- Mark partial payment with amount and method.
- Edit amount paid, method, and notes.
- Mark as waived.
- Mark as **refunded** when cash was returned outside the app (after `paid` or `partial`).
- **Reset to unpaid** to correct a mistaken status change (not for real cash returns).
- Filter by payment status including refunded.
- See session totals.

Session totals should include:

- Total expected.
- Total collected (`paid` and `partial` amounts only).
- Total unpaid.
- Total waived.
- Total refunded (amounts marked refunded — reduces net collected view).
- Count by payment status (all five statuses).

## Queue Interaction

MVP v1 payment tracking is **informational only**. It does not gate queueing, suggestions, or court assignment.

Rules:

- Unpaid and partial players **may** appear in auto-suggestions and be staged or sent to court like any other checked-in player.
- Show payment status inline (`PaymentBadge`) so the organizer can collect money, but do not block play programmatically.
- Optional UI warnings such as `Ana is unpaid` are allowed as reminders; they must not prevent accept or send-to-court without a separate future setting.

### Future: `requirePaymentBeforePlay`

Deferred past MVP v1. Do not expose this toggle in session setup or dashboard for now.

When implemented in a future version:

- Session setting: `requirePaymentBeforePlay`: boolean.
- If enabled: `unpaid` and `partial` players are excluded from auto-suggestions; organizer may still manually assign with explicit override.

MVP implementation:

- Persist `requirePaymentBeforePlay` as `false` on all sessions, or omit the field from MVP create/update payloads.
- Do not build queue-blocking logic until this future spec is activated.

## Audit Expectations

For MVP, last-updated metadata is enough. Add full payment event history only when the product needs accountability across multiple collectors.

Minimum audit fields:

- Who updated the payment state.
- When it changed.
- Current note.
- Whether the latest payment change is pending sync, synced, or failed.

## Offline Payment Tracking

Rules:

- Marking a player as paid, partial, waived, unpaid, or refunded creates an `UPDATE_PAYMENT` sync action from `docs/specs/backend/sync-actions.md` when offline.
- Payment totals should update immediately from local state.
- Payment rows with unsynced changes should show pending sync state.
- If sync fails, preserve the local payment change and show a recoverable error.
- Replaying the same payment sync action must be idempotent.
- Payment status remains session-specific and must not update global player records.

## Validation Rules

- `paymentAmountPaid` cannot be negative.
- `paymentAmountDue` defaults from the session fee.
- `paid` requires `paymentAmountPaid >= paymentAmountDue` unless amount due is zero.
- `partial` requires `paymentAmountPaid > 0` and `< paymentAmountDue`.
- `waived` can have zero amount paid.
- `refunded` applies when the organizer returned payment outside the app after `paid` or `partial`. Preserve prior amount and method in `paymentNotes` when useful. Excludes the row from collected totals.
- **Reset to unpaid** is a correction path: sets `unpaid` and clears paid amount; use for mistaken marks, not for real refunds.
