# Toast

## Purpose

Confirms lightweight outcomes or displays recoverable errors without blocking the workflow.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use after successful quick actions such as `Player checked in` or `Payment marked paid`.
- Use for recoverable errors where the current screen remains usable.

## When Not To Use

- Do not use for critical information the user must act on later.
- Do not use as the only error message for form validation.

## Props Or Data Contract

- `title`: short message.
- `description`: optional detail.
- `variant`: `success`, `info`, `warning`, or `danger`.
- `action`: optional action such as `Undo`.
- `duration`: display duration.

## States

- Entering, visible, exiting, and action available.

## Accessibility

- Announce to assistive technology using an appropriate live region.
- Do not steal focus.

## Responsive Behavior

- Mobile: avoid covering sticky primary actions.
- Tablet and desktop: stack predictably in a non-blocking region.

## Content Rules

- Keep copy specific and short: `Payment marked paid`.
- Use `Undo` only when backend support exists.

## Testing Expectations

- Renders message and variant.
- Auto-dismisses when configured.
- Optional action fires callback.

## Anti-Patterns

- Long paragraphs in toasts.
- Toast-only handling for permission or payment errors.
