# FormField

## Purpose

Provides consistent label, helper text, validation message, and control layout for forms.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use around inputs, selects, textareas, and custom form controls.

## When Not To Use

- Do not use for read-only metadata.
- Do not hide labels by relying only on placeholders.

## Props Or Data Contract

- `id`: connects label, helper text, and control.
- `label`: required visible label.
- `helperText`: optional guidance.
- `error`: validation message.
- `required`: marks required field.
- `children`: form control.

## States

- Default, focused child, disabled child, error, and required.

## Accessibility

- Label must be programmatically associated with the control.
- Error text must be announced when validation fails.
- Required state must be conveyed accessibly.

## Responsive Behavior

- Use full-width controls on mobile.
- Keep label and validation close to the field.

## Content Rules

- Labels should be short: `Player name`, `Amount paid`.
- Helper text should explain format or consequence.

## Testing Expectations

- Label association works.
- Error message is visible and announced.
- Required state is represented.

## Anti-Patterns

- Placeholder-only forms.
- Validation messages grouped far from the failing field.
