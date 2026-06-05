# Card

## Purpose

Groups related information and actions into a scannable surface. Cards should answer a concrete user question.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for court state, match summaries, player status, metrics, and dashboard sections.
- Use when information needs a visible boundary or action grouping.

## When Not To Use

- Do not wrap every small element in a card.
- Do not create decorative cards without a decision or user question.

## Props Or Data Contract

- `title`: optional heading.
- `description`: optional supporting text.
- `children`: card content.
- `actions`: optional action region.
- `variant`: `surface`, `outlined`, `elevated`, or `warning`.
- `size`: `compact`, `default`, or `large`.

## States

- Default, focus-within, selected, disabled, and warning when applicable.

## Accessibility

- Use semantic headings when the card introduces a section.
- Interactive cards must expose a clear accessible action.

## Responsive Behavior

- Cards should adapt to container width.
- Avoid fixed heights that break with long names or translated labels.

## Content Rules

- Titles should be specific: `Court 3`, `Unpaid players`, `Next match`.

## Testing Expectations

- Renders title, content, and actions.
- Handles long content without layout breakage.

## Anti-Patterns

- Generic dashboard cards labeled `Insights`.
- Nested cards that make hierarchy unclear.
