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

- `match`: id, status, court, teams, scores, outcome, winner, ratingApplied, timestamps.
- `queueLane`: optional id and name when the card represents a queued match.
- `actions`: move to lane, move to court, swap player, start, finish, record score, cancel, remove from queue, or view details.
- `showRatingImpact`: optional.
- `perspectivePlayerId`: optional for player-facing partner/opponent emphasis.
- `slotState`: optional state for incomplete queued matches.

## Variants And Sizes

- `queued` — stacked match card with Team A/B columns, nested player mini-cards, dashed empty slots, match number header.
- `queuedIncomplete`
- `assigned`
- `active`
- `completed`
- `history`
- `playerUpcoming`

## States

- Queued, queued incomplete, moving between lanes, assigned, in progress, completed, cancelled, loading action, pending sync, and correction available.

## Accessibility

- Team pairing must be readable in text.
- Score and winner must not rely on color.
- Repeated actions should include match or court context.
- Empty queued match slots must have accessible labels.

## Responsive Behavior

- Mobile: stack team names and keep next action first.
- Tablet: show teams side by side for active matches.
- Desktop: queued matches can appear in vertical queue lanes beside courts.

## Content Rules

- Use `Team 1` and `Team 2` only when player names are present.
- Use result labels: `Won`, `Lost`, `Draw`, `Cancelled`, `Unscored`.
- Draw must not be presented as a win for either side.
- Unscored should read as completed without competitive result.
- Queued match copy should support staging language: `Move to court`, `Move to lane`, `Suggested`, `Needs 1 player`.

## Testing Expectations

- Renders all match statuses.
- Formats scores consistently.
- Highlights perspective player correctly when provided.
- Renders queued and incomplete queued variants.
- Renders lane movement actions when `queueLane` context is provided.

## Anti-Patterns

- Showing cancelled matches like completed results.
- Showing draws as two wins.
- Flattening four players without team structure.
- Hiding incomplete queued slots.
- Making lane movement drag-only without an accessible menu or button alternative.
