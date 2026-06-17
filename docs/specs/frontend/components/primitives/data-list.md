# DataList

## Purpose

Displays labeled rows of read-only or lightly interactive metadata in a compact, scannable list. Common in drawers and detail panels.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use inside `Drawer` panels for player detail, match detail, and sync review rows.
- Use for term/value pairs such as `Queue status`, `Session rating`, `Phone`, or `Last synced`.
- Use when a full form layout is heavier than needed for mostly read-only content.

## When Not To Use

- Do not use for editable forms with many inputs; use `FormField` groups instead.
- Do not use for sortable tables or long paginated lists; use `PlayerRow` lists or page tables.
- Do not use as the only way to perform primary actions; pair with buttons in the drawer footer.

## Props Or Data Contract

- `items`: ordered rows.
- `item.term`: left-column label.
- `item.value`: right-column content (text, badge, or small custom node).
- `item.action`: optional trailing action such as `Edit` or `Copy`.
- `density`: `compact` or `default`.
- `divider`: optional row separators.

## Variants And Sizes

- `default`: drawer detail sections.
- `compact`: inline metadata under a card title.

## States

- Default, loading skeleton row, empty (`No details`), and error row.

## Accessibility

- Term and value must be programmatically associated (`dl`/`dt`/`dd` or equivalent).
- Badges in values must include text labels.
- Optional actions must have accessible names.

## Responsive Behavior

- Mobile: stack term above value when horizontal space is tight, or keep two-column with wrapping values.
- Tablet and desktop: two-column term/value alignment.

## Content Rules

- Terms use sentence case: `Session rating`, not `SESSION_RATING`.
- Values use domain formatters for money, time, and ratings.
- Do not show empty values as blank; use `—` or `Not set`.

## Testing Expectations

- Renders all items with term and value.
- Optional actions call callbacks.
- Compact and default densities render predictably.

## Anti-Patterns

- More than twelve rows without section headings; split with headings or tabs.
- Using `DataList` for primary navigation lists.
