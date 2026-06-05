# Tabs

## Purpose

Switches between related views within the same page or panel without route navigation.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for queue status groups, payment filters, and compact dashboard sections.

## When Not To Use

- Do not use for unrelated workflows.
- Do not hide critical alerts behind an inactive tab without a count or indicator.

## Props Or Data Contract

- `tabs`: list of labels, values, and optional counts.
- `value`: selected tab.
- `onChange`: selection callback.
- `orientation`: `horizontal` or `vertical`.

## States

- Default, selected, focused, disabled tab, and overflow.

## Accessibility

- Follow tablist semantics.
- Support arrow-key navigation.
- Selected tab must be announced.

## Responsive Behavior

- Mobile: horizontal scroll is acceptable when labels remain readable.
- Tablet and desktop: keep high-frequency tabs visible.

## Content Rules

- Use short labels: `Waiting`, `Resting`, `Done`.
- Counts may be shown when they guide action.

## Testing Expectations

- Selection changes panel.
- Keyboard navigation works.
- Count labels remain accessible.

## Anti-Patterns

- More tabs than users can scan.
- Tabs used as primary site navigation.
