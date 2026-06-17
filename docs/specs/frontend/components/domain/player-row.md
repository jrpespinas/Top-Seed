# PlayerRow

## Purpose

Displays one player in queue, payment, check-in, roster, or assignment contexts with key operational metadata.

In pegboard-inspired areas, this component may behave like a player token: something the organizer can move from the available pool to next queue lanes, to court slots, and back to `waiting` after a match. `resting` is an explicit organizer action only.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/backend/domain-model.md`
- `docs/specs/backend/state-transitions.md`

## When To Use

- Use in queue lists, payment lists, check-in search results, and player management lists.
- Use as a compact assignable player token in player pool, next queue, and court slot workflows.

## When Not To Use

- Do not use for a full player profile page.
- Do not overload with every player statistic.

## Props Or Data Contract

- `player`: display name, optional contact, optional profile id.
- `checkIn`: queue status, session rating, wait time, matches played.
- `payment`: payment status and amount summary.
- `actions`: context-specific row actions. On management lists, prefer `onOpenPlayerDetails` over inline field editors.
- `assignmentState`: optional `available`, `queued`, `onCourt`, `resting`, or `done`.
- `queuedMatchIds`: optional list when the same player appears in multiple Next-lane staged matches.
- `dragHandleProps`: optional desktop drag/drop affordance metadata.
- `isSelected`: optional.

## Variants And Sizes

- `queue`: emphasizes wait time and queue status.
- `payment`: emphasizes payment status.
- `search`: emphasizes identity and selection.
- `token`: compact player-token treatment for assignment workflows.
- `compact`: dense lists.

## States

- Default, selected, draggable, queued, on court, recently played, unpaid warning, **skipped from suggestions**, removed/done muted, loading action, pending sync, and error.

## Accessibility

- Player name must be visible text.
- Row actions require descriptive labels.
- Status must not rely on color alone.
- Drag-and-drop must have button/menu alternatives such as `Add to next match`, `Move to Court 2`, `Remove from queue`, or `Mark resting`.

## Responsive Behavior

- Mobile: primary metadata visible, secondary actions behind menu or drawer. Do not require drag-and-drop.
- Tablet: show status, rating, payment, and wait time inline.
- Desktop: optional drag handle may appear when assignment mode is active.

## Content Rules

- Use compact labels such as `12 min`, `3 games`, `Rating 3.4`.
- Do not expose organizer notes in player-facing rows.
- Do not render inline `FormField` editors for profile fields (`gender`, club rating, notes) on list rows — use `PlayerDetailDrawer`.
- Session skill rating may display as read-only text on the row; edit in drawer.
- Token actions should use movement language: `Add to next match`, `Move to court`, `Send to resting`, `Back to waiting`.
- A player token may appear on multiple Next-lane cards when staged for future matchups.

## Testing Expectations

- Renders queue, payment, and search variants.
- Handles long names and missing optional data.
- Row actions call expected callbacks.
- Token variant supports non-drag assignment actions.

## Anti-Patterns

- Dense table-only rows on mobile.
- Payment warnings hidden in a secondary detail view.
- Drag-only player movement.
- Player tokens without visible name or status.
