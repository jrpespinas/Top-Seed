# EmptyState

## Purpose

Explains what is missing and gives the user a clear next step.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use when a panel, list, page, or search result has no content.

## When Not To Use

- Do not use for loading states.
- Do not use generic `No data found` copy.

## Props Or Data Contract

- `title`: specific empty message.
- `description`: optional explanation.
- `action`: optional primary action.
- `secondaryAction`: optional secondary action.
- `tone`: `neutral`, `info`, or `warning`.

## States

- Neutral, actionable, warning, and search-no-results.

## Accessibility

- Empty state text should be visible and readable.
- Actions must follow button or link accessibility rules.

## Responsive Behavior

- Mobile: compact copy and one clear action.
- Tablet and desktop: may include more explanation when helpful.

## Content Rules

- Explain the missing condition and next action.
- Example: `No courts yet. Add courts to start building the session board.`

## Testing Expectations

- Renders title, description, and action.
- Handles no-action state.

## Anti-Patterns

- Decorative illustrations that dominate operational pages.
- Empty states that blame the user.
