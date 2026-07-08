# Spec: Payment Tracking & Session Management

> **This file is a target/blueprint spec** (like `docs/ARCHITECTURE.md`), not a description of what's built. Two pieces of it now have a real, but simpler, ground-truth implementation:
> - Payment status (Paid/Unpaid/Waived, no amounts) is documented in `docs/specs/01-player-management.md`.
> - Session lifecycle (start/close, `/sessions` list + detail) is documented in `docs/specs/08-sessions.md`, which also lists exactly what this file describes that isn't built yet (fee amounts, reopening, a `/sessions/[id]/payments` sub-route, blocking concurrent sessions).

## Scope
Manual cash/transfer ledger per session. No payment processing. Session lifecycle (open/close) is also managed here.

---

## Data Model Notes (see ARCHITECTURE.md)
- `Session.status`: `OPEN | CLOSED` — only one session can be OPEN at a time
- `Payment` — one record per player per session; created manually by organizer
- `Payment.amount` — defaults to `session.defaultFee` on creation; can be overridden per player
- `Payment.status`: `UNPAID | PAID | WAIVED`
- Deleting a payment record is not allowed — set to WAIVED to preserve audit trail
- All amounts in Philippine Peso (₱); currency is not configurable

---

## Session Lifecycle

### Rules
- Only one session can be OPEN at a time — "New Session" is blocked if one is already open
- Closing a session blocks queue and match creation; payment records remain editable after close
- A closed session can be reopened by the organizer

### `/sessions` — Session List

- Table: Date, Players, Collected, Outstanding, Status (Open / Closed)
- **"New Session"** button — creates session with today's date and last-used default fee; blocked if a session is already open (tooltip: "Close the current session first")
- **"Close Session"** button on the open session row — prompts confirmation if unpaid balances exist; closes the session
- **"Reopen"** button on closed sessions — reopens and sets status back to OPEN (blocked if another session is already open)
- Clicking a session row navigates to `/sessions/[id]/payments`

---

## Payment Tracking

### `/sessions/[id]/payments` — Session Payment View

**Session header** (top of page):
- Session date, status badge (Open / Closed)
- **"Edit Default Fee"** → updates session fee and optionally bulk-updates all UNPAID records
- **"Close Session"** button (if OPEN)

**Summary bar:**
- Total Collected (sum of PAID amounts), Outstanding (sum of UNPAID amounts), Players Paid / Total

**Payment table:**

| Player | Skill | Amount | Status | Notes | Actions |
|--------|-------|--------|--------|-------|---------|
| Alice  | A     | ₱150   | Paid   |       | Edit    |
| Bob    | C     | ₱150   | Unpaid |       | Edit    |
| Carol  | E     | ₱0     | Waived | volunteer | Edit |

- Rows sorted: Unpaid first, then Waived, then Paid
- **Quick-toggle**: clicking the status pill cycles Unpaid → Paid only (one tap for the common case)
- **"Add Player to Session"** button → opens `AddPlayerToSessionDialog`; creates an UNPAID payment at the default fee

### Components
- `PaymentStatusPill` — clickable toggle (Unpaid → Paid one tap); gray=Unpaid, green=Paid, yellow=Waived
- `PaymentEditDialog` — amount field, status select (Unpaid / Paid / Waived), notes textarea
- `SessionSummaryBar` — collected / outstanding / paid count chips
- `AddPlayerToSessionDialog` — player picker; active players not yet in this session's payment ledger
- `EditDefaultFeeDialog` — new fee input + checkbox "Apply to all Unpaid records in this session"

---

## Server Actions (`src/server/actions/sessions.ts` and `src/server/actions/payments.ts`)

```typescript
// sessions.ts

createSession(data: { date?: Date; defaultFee: number; notes?: string }): Promise<Session>
// error if another session is already OPEN

closeSession(sessionId: string): Promise<Session>
// sets status=CLOSED; warns but does not block on unpaid balances

reopenSession(sessionId: string): Promise<Session>
// error if another session is already OPEN

updateSessionFee(sessionId: string, newFee: number, applyToUnpaid: boolean): Promise<Session>
// if applyToUnpaid=true, updates amount on all UNPAID records in this session

getSession(sessionId: string): Promise<SessionDetail>
// includes all payments with player info

getSessions(): Promise<Session[]>
// ordered by date DESC
```

```typescript
// payments.ts

addPlayerToSession(sessionId: string, playerId: string): Promise<Payment>
// creates Payment with status=UNPAID, amount=session.defaultFee

updatePayment(paymentId: string, data: {
  status?: PaymentStatus
  amount?: number
  notes?: string
}): Promise<Payment>

togglePaymentPaid(paymentId: string): Promise<Payment>
// cycles UNPAID → PAID only; Waived and already-Paid records are not affected
```

---

## Validation (Zod)

```typescript
const CreateSessionSchema = z.object({
  date: z.date().optional(),
  defaultFee: z.number().min(0).max(10000),
  notes: z.string().max(500).optional(),
})

const UpdatePaymentSchema = z.object({
  status: z.enum(['PAID', 'UNPAID', 'WAIVED']).optional(),
  amount: z.number().min(0).max(10000).optional(),
  notes: z.string().max(500).optional(),
})
```

---

## Payment Status Semantics

| Status  | Meaning |
|---------|---------|
| `UNPAID`  | Player owes the fee — default on add |
| `PAID`    | Organizer received cash/transfer |
| `WAIVED`  | Fee forgiven (e.g., volunteer, guest) |

---

## Edge Cases
- **New session when one is open**: blocked — tooltip "Close the current session first"
- **Close session with unpaid balances**: warn organizer in confirmation dialog, but allow close
- **Reopen session when another is open**: blocked — "Close [other session] before reopening this one"
- **Same player added to session twice**: blocked by `@@unique([sessionId, playerId])` — "Player already in this session's ledger"
- **Default fee changed after some players already paid**: only UNPAID records updated if `applyToUnpaid=true`; PAID and WAIVED records never touched
- **Amount set to 0 with status Paid**: valid — player paid exactly zero (e.g., comp)
- **Deleting a payment**: not allowed — use Waived status to preserve audit trail
- **Editing payments on a closed session**: allowed — session close does not lock payment records
- **Match/queue creation on a closed session**: blocked — "Session is closed. Reopen it to record matches."
