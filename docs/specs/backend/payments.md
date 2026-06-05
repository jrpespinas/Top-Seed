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

- Mark one player as paid from the live dashboard.
- Edit amount paid.
- Add a note such as reference number or collector name.
- Mark as waived.
- Filter unpaid players.
- See session totals.

Session totals should include:

- Total expected.
- Total collected.
- Total unpaid.
- Total waived.
- Count by payment status.

## Queue Interaction

The default MVP should allow organizers to decide whether unpaid players can be queued.

Session setting:

- `requirePaymentBeforePlay`: boolean.

If enabled:

- `unpaid` and `partial` players are excluded from auto-suggestions.
- Organizer can still manually assign them with an explicit override.

If disabled:

- Payment status is visible but does not affect queue suggestions.

## Audit Expectations

For MVP, last-updated metadata is enough. Add full payment event history only when the product needs accountability across multiple collectors.

Minimum audit fields:

- Who updated the payment state.
- When it changed.
- Current note.
- Whether the latest payment change is pending sync, synced, or failed.

## Offline Payment Tracking

Rules:

- Marking a player as paid, partial, waived, unpaid, or refunded creates a local pending sync action when offline.
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
- `refunded` should preserve previous amount notes if known.
