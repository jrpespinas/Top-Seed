# PaymentBadge

## Purpose

Shows a player's session-level payment status without turning the interface into an accounting screen.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/backend/payments.md`

## When To Use

- Use in player rows, payment lists, check-in details, and dashboard exceptions.

## When Not To Use

- Do not use to represent online payment processing.
- Do not show payment controls to players unless product explicitly allows it.

## Props Or Data Contract

- `status`: `unpaid`, `partial`, `paid`, `waived`, or `refunded`.
- `amountDue`: optional amount.
- `amountPaid`: optional amount.
- `method`: optional payment method.
- `size`: `compact`, `default`, or `large`.
- `isInteractive`: whether it opens payment detail.

## States

- Default, interactive focus, warning for unpaid/partial, and neutral for paid/waived.

## Accessibility

- Include readable text for status and amount when shown.
- Interactive badge must be keyboard reachable.

## Responsive Behavior

- Compact form in player rows.
- Expanded detail in payment panels and drawers.

## Content Rules

- Use `Mark paid`, not `Charge`.
- Use `Payment tracked manually`, not `Payment processed`.

## Testing Expectations

- Renders all payment states.
- Formats money through shared formatter.
- Does not expose organizer-only interaction when disabled.

## Anti-Patterns

- Treating `waived` like an error.
- Showing payment provider language in MVP.
