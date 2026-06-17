# CourtCard

## Purpose

Shows one badminton court as a spatial container with Team A and Team B player slots, current match state, and next available action.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/backend/domain-model.md`
- `docs/specs/backend/state-transitions.md`

## When To Use

- Use inside `CourtBoard` and dashboard court summaries.

## When Not To Use

- Do not use for match history without court operations; use `MatchCard`.
- Do not place queue-generation logic inside this component.

## Props Or Data Contract

- `court`: id, name, status, optional note.
- `activeMatch`: optional match with teams and status.
- `teamSlots`: Team A and Team B slots, including occupied and empty player positions.
- `primaryAction`: state-specific action.
- `secondaryActions`: pause, reopen, view details, or cancel.
- `dropTargets`: optional desktop drag/drop target metadata.
- `isSelected`: optional selection state.

## Variants And Sizes

- `default`: dashboard card.
- `large`: active court focus.
- `compact`: court summaries.

## States

- `open`, `partiallyFilled`, `occupied`, `inProgress`, `paused`, `unavailable`, selected, loading action, pending sync, and error.

`partiallyFilled` and `inProgress` are derived UI labels, not separate backend court statuses:

| Backend `court.status` | `match.status` | UI state |
|------------------------|----------------|----------|
| `open` | none | `open` |
| `occupied` | `assigned` with incomplete roster | `partiallyFilled` |
| `occupied` | `assigned` with full roster | `occupied` |
| `occupied` | `in_progress` | `inProgress` |
| `paused` | any | `paused` |
| `unavailable` | any | `unavailable` |

Primary actions by match state:

- `assigned` with full roster: `Start match`
- `in_progress`: `Finish match` or record result
- `open`: accept drop or assignment actions

## Accessibility

- Court name and status must be readable together.
- Action labels should include court name when repeated.
- Empty slots must have accessible labels such as `Team A player 1 empty`.
- Drag-and-drop targets require equivalent keyboard/button actions.

## Responsive Behavior

- Mobile: stack court cards in priority order.
- Tablet: grid layout with active matches readable at arm's length.
- Desktop: grid can show more metadata.

## Content Rules

- Show occupied court players by team pair, not as a flat list.
- Show open player slots as intentional empty positions, not missing content.
- Use labels like `Team A`, `Team B`, `Player 1`, and `Player 2` where needed for clarity.
- Explain paused/unavailable note when available.

## Testing Expectations

- Renders all court states.
- Shows correct primary action by state.
- Handles long player names.
- Renders occupied and empty team slots accessibly.

## Anti-Patterns

- Hiding court status behind color only.
- Allowing actions that conflict with an active match state.
- Making drag-and-drop the only way to add, remove, or move players.
