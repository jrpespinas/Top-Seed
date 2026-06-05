# SearchInput

## Purpose

Helps users find players, sessions, or filtered list items quickly.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for player lookup, session filtering, and list search.

## When Not To Use

- Do not use for selecting from a short fixed enum; use `Select`.
- Do not trigger destructive or mutating actions directly from typing.

## Props Or Data Contract

- `value`: current query.
- `placeholder`: short hint.
- `resultsLabel`: accessible result context if used with results.
- `isLoading`: search progress.
- `onChange`: query update callback.
- `onClear`: clears query.

## States

- Empty, typing, loading, results available, no results, focused, and disabled.

## Accessibility

- Must have accessible label.
- Clear button requires accessible label.
- Search results must be reachable by keyboard when coupled with a result list.

## Responsive Behavior

- Full-width in mobile check-in and player search flows.
- Preserve query when validation or network errors occur.

## Content Rules

- Placeholder should be contextual: `Search player name or phone`.

## Testing Expectations

- Query changes call callback.
- Clear action resets value.
- Loading and no-results states render.

## Anti-Patterns

- Placeholder-only labeling.
- Search inputs that silently auto-create records.
