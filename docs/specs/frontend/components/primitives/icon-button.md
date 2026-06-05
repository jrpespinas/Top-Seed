# IconButton

## Purpose

Triggers a compact action where space is limited and the action is already clear from context.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for secondary actions inside rows, cards, drawers, and toolbars.
- Use when the same action is repeated across a dense list.

## When Not To Use

- Do not use for primary courtside actions like `Finish match` or `Mark paid`.
- Do not use decorative icons as buttons.

## Props Or Data Contract

- `icon`: visual icon.
- `ariaLabel`: required accessible label.
- `variant`: `plain`, `secondary`, or `danger`.
- `size`: `compact` or `default`.
- `isLoading`: optional progress state.
- `disabled`: blocks interaction.
- `onClick`: action callback.

## States

- Default, hover, focus, pressed, disabled, and loading.

## Accessibility

- Requires `ariaLabel`.
- Must have visible focus state.
- Minimum touch target is `2.75rem` in mobile and tablet flows.

## Responsive Behavior

- Keep touch target comfortable even if the icon is visually small.
- Prefer a text button on mobile when action meaning is not obvious.

## Content Rules

- Accessible labels should be specific: `Pause Court 2`, not `Pause`.

## Testing Expectations

- Verifies accessible label.
- Verifies disabled and loading behavior.
- Verifies click callback.

## Anti-Patterns

- Icon-only destructive actions without confirmation.
- Different icons for the same action across screens.
