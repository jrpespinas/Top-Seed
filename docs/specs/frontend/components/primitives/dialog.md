# Dialog

## Purpose

Interrupts the user for a focused decision or confirmation that should not happen inline.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for destructive confirmations, completing a session, cancelling a match, or important modal decisions.

## When Not To Use

- Do not use for quick side edits; use `Drawer`.
- Do not chain dialogs.

## Props Or Data Contract

- `isOpen`: visibility state.
- `title`: required decision title.
- `description`: consequence or supporting detail.
- `children`: body content.
- `primaryAction`: main action.
- `secondaryAction`: cancel or alternative action.
- `onOpenChange`: close handler.

## States

- Opening, open, closing, loading action, and error.

## Accessibility

- Trap focus while open.
- Restore focus on close.
- Close with escape unless a blocking submission is in progress.
- Provide accessible title and description.

## Responsive Behavior

- Centered dialog on tablet and desktop.
- Full-width inset dialog or bottom sheet treatment on small mobile screens if needed.

## Content Rules

- Title states the decision: `Cancel this match?`
- Body explains consequence: `Cancelled matches do not update ratings.`

## Testing Expectations

- Focus trap works.
- Escape and cancel close the dialog.
- Confirm action fires once.

## Anti-Patterns

- Using dialogs for routine check-in or payment edits.
- Body copy that repeats the button label without explaining consequence.
