# MatchCard

## Purpose

Displays queued, assigned, active, completed, or cancelled badminton match details.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/backend/domain-model.md`

## When To Use

- Use for next queue matches, active matches, recent match history, and match detail summaries.

## When Not To Use

- Do not use as the full court operation card when court state is primary; use `CourtCard`.

## Props Or Data Contract

- `match`: id, status, court, teams, scores, winner, timestamps.
- `actions`: move to court, swap player, start, finish, record score, cancel, remove from queue, or view details.
- `showRatingImpact`: optional.
- `perspectivePlayerId`: optional for player-facing partner/opponent emphasis.
- `slotState`: optional state for incomplete queued matches.

## Variants And Sizes

- `queued`
- `queuedIncomplete`
- `assigned`
- `active`
- `completed`
- `history`
- `playerUpcoming`

## States

- Queued, queued incomplete, assigned, in progress, completed, cancelled, loading action, pending sync, and correction available.

## Accessibility

- Team pairing must be readable in text.
- Score and winner must not rely on color.
- Repeated actions should include match or court context.
- Empty queued match slots must have accessible labels.

## Responsive Behavior

- Mobile: stack team names and keep next action first.
- Tablet: show teams side by side for active matches.
- Desktop: queued matches can appear in a vertical staging lane beside courts.

## Content Rules

- Use `Team 1` and `Team 2` only when player names are present.
- Use result labels: `Won`, `Lost`, `Cancelled`, `Unscored`.
- Queued match copy should support staging language: `Move to court`, `Auto-filled`, `Needs 1 player`.

## Testing Expectations

- Renders all match statuses.
- Formats scores consistently.
- Highlights perspective player correctly when provided.
- Renders queued and incomplete queued variants.

## Anti-Patterns

- Showing cancelled matches like completed results.
- Flattening four players without team structure.
- Hiding incomplete queued slots.
