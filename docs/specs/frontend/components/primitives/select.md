# Select

## Purpose

Lets users choose one value from a controlled set of options.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for payment method, status filters, sort options, court selection, and controlled enum fields.

## When Not To Use

- Do not use for searching long player lists; use `SearchInput`.
- Do not use when multiple selections are required unless a multi-select variant is explicitly designed.

## Props Or Data Contract

- `value`: selected value.
- `options`: label and value list.
- `placeholder`: optional.
- `disabled`: blocks interaction.
- `error`: validation state when integrated with `FormField`.
- `onChange`: selection callback.

## States

- Closed, open, focused, selected, disabled, loading options, and error.

## Accessibility

- Must be label-associated through `FormField`.
- Keyboard navigation must work.
- Current selection must be announced.

## Responsive Behavior

- Mobile options should remain large enough to tap.
- Avoid long option labels that overflow narrow screens.

## Content Rules

- Option labels should be human-readable: `Bank transfer`, not `bank_transfer`.

## Testing Expectations

- Selection updates value.
- Keyboard interaction works.
- Disabled and error states render.

## Anti-Patterns

- Large searchable datasets in a normal select.
- Enum labels leaking backend naming.
