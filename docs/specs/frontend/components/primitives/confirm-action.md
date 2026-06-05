# ConfirmAction

## Purpose

Wraps actions that need explicit confirmation before execution.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/components/primitives/dialog.md`

## When To Use

- Use for cancelling matches, removing players, cancelling sessions, and completing sessions.

## When Not To Use

- Do not use for routine reversible actions.
- Do not use when backend cannot safely handle repeated submissions.

## Props Or Data Contract

- `triggerLabel`: visible action label.
- `title`: confirmation title.
- `description`: consequence explanation.
- `confirmLabel`: final action label.
- `cancelLabel`: cancel label.
- `variant`: `danger` or `default`.
- `onConfirm`: confirmed action callback.

## States

- Idle, dialog open, confirming, confirmed, and error.

## Accessibility

- Uses `Dialog` accessibility requirements.
- Trigger and confirm buttons must have clear labels.

## Responsive Behavior

- Dialog behavior follows `dialog.md`.

## Content Rules

- Explain consequence, especially rating, payment, or queue impact.
- Example: `Cancelled matches do not update ratings.`

## Testing Expectations

- Does not call `onConfirm` before confirmation.
- Calls `onConfirm` once after confirmation.
- Handles confirm loading and errors.

## Anti-Patterns

- Confirmation text that says only `Are you sure?`
- Confirming low-risk actions that organizers perform repeatedly.
