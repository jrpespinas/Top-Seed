# StatusBadge

## Purpose

Displays queue, court, payment, or match state in a consistent, readable way.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for statuses such as `waiting`, `playing`, `open`, `paid`, and `completed`.

## When Not To Use

- Do not use for arbitrary marketing labels.
- Do not invent one-off labels in feature components.

## Props Or Data Contract

- `type`: `queue`, `court`, `payment`, or `match`.
- `status`: known status value from the domain model.
- `size`: `compact`, `default`, or `large`.
- `showIcon`: optional icon support.

## Variants And Sizes

- Visual tone must map centrally from `type` and `status`.
- Size affects padding and text scale, not label wording.

## States

- Default, focused when interactive, and disabled when used inside disabled controls.

## Accessibility

- Text label is required.
- Color cannot be the only indicator.

## Responsive Behavior

- Compact badges may be used in dense rows.
- Player-facing current status may use large badge treatment.

## Content Rules

- Use canonical labels from `design-system.md`.
- Backend enum labels must not leak into UI.

## Testing Expectations

- Every known status renders expected text.
- Unknown statuses fall back safely or fail during development.

## Anti-Patterns

- Rainbow badge colors without semantic meaning.
- Badges that hide critical text behind icons only.
