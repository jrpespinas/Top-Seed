# MetricCard

## Purpose

Summarizes an operational count or amount that helps the organizer decide what to do next.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for checked-in count, waiting count, open courts, unpaid players, collected amount, and active matches.

## When Not To Use

- Do not use for vanity metrics unrelated to running the session.
- Do not use when a detailed list is more useful than a summary.

## Props Or Data Contract

- `label`: metric label.
- `value`: formatted value.
- `description`: optional context.
- `tone`: `neutral`, `success`, `warning`, `danger`, or `info`.
- `actionLabel`: optional link or filter action.
- `onAction`: optional callback.

## States

- Default, interactive, warning, loading, and empty.

## Accessibility

- Value and label must be read together.
- Interactive card must expose its action clearly.

## Responsive Behavior

- Mobile: compact horizontal cards or scrollable row.
- Tablet: visible status bar metrics.
- Desktop: may sit beside dashboard panels.

## Content Rules

- Labels should imply action: `Unpaid`, `Open courts`, `Waiting`.

## Testing Expectations

- Renders formatted values.
- Action filters or navigation fire when provided.
- Loading state does not shift layout drastically.

## Anti-Patterns

- Cards labeled `Engagement` or `Performance` in MVP.
- Metrics that duplicate nearby content without helping decisions.
