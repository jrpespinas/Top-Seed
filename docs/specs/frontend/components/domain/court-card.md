# CourtCard

## Purpose

Shows one badminton court as a spatial container with Team A and Team B player slots, current match state, and next available action. Idle open courts remain fully visible so organizers can see how many courts are waiting for a match.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/features/organizer/court-board.md`
- `docs/specs/backend/domain-model.md`
- `docs/specs/backend/state-transitions.md`

## When To Use

- Use inside `CourtBoard` and dashboard court summaries.

## When Not To Use

- Do not use for match history without court operations; use `MatchCard`.
- Do not place queue-generation logic inside this component.

## Props Or Data Contract

- `court`: id, name, optional note.
- `uiStatus`: derived UI state (see States).
- `teamSlots`: Team A and Team B slots, including occupied and empty player positions.
- `primaryAction`: state-specific footer CTA (`Start match`, `Finish match`).
- `secondaryActions`: optional overflow menu items (pause, reopen, etc.).
- `onDelete`: optional; opens confirm dialog from overflow menu when court is deletable.
- `dropTargets`: optional desktop drag/drop target metadata (Phase 11D). See `features/organizer/desktop-drag-and-drop.md`.

## Card Anatomy

```text
┌─ Court 1 ─────────────── 0/4 · Open ─── [⋯] ┐
│  Team A          │ vs │  Team B               │
│  Empty           │    │  Empty                │
│  Empty           │    │  Empty                │
├──────────────────────────────────────────────┤
│  [ Start match — primary, full width ]        │  ← when assigned
└──────────────────────────────────────────────┘
```

### Header

- **Court name** — largest text on card (`text-title` when `size="large"`).
- **Capacity** — `{filled}/4` badge when idle open (0/4) or when players are assigned.
- **Status badge** — `Open`, `Occupied`, `In progress`, etc.
- **Overflow (`⋯`)** — secondary actions and **Delete {court name}** (destructive, confirm dialog). No standalone delete button below the card.

### Roster

- **Team A | vs | Team B** — same column pattern as staged `MatchCard`.
- **Filled slots** — flat player token (avatar + name), not nested mini-cards.
- **Empty slots** — dashed inset labeled `Empty`; accessible name `Team A slot 1, empty`.
- **Idle open courts** — keep all four empty slots visible to show court capacity at a glance. Do not use `Drop player here` until P5 direct assign exists.

### Body copy (idle open)

- No instructional line — empty slots and `0/4` convey idle state.

### Footer

- **Start match** / **Finish match** — full-width `primary` button when a match is assigned or in progress.
- No footer on idle open courts.

## Variants And Sizes

- `default`: dashboard card.
- `large`: pegboard / courts zone focus.
- `compact`: summaries.

## States

| UI state | Visual | Primary action |
|----------|--------|----------------|
| `open` (idle) | Neutral surface; 0/4 visible | None — guidance copy only |
| `partiallyFilled` | Court green tint | Per match rules |
| `occupied` (assigned, full roster) | Court green tint | **Start match** |
| `inProgress` | Court tint + ring | **Finish match** |
| `paused` | Muted | Reopen (overflow) |
| `unavailable` | Muted + opacity | None |

MVP promotes **full ready matches** from Upcoming Matches only (Phase 11D). Do not imply per-player slot drops on idle open courts.

## Accessibility

- Court name and status readable together.
- Primary actions: `Start match on Court 3`, `Finish match on Court 3`.
- Empty slots: `Team A slot 1, empty` (not misleading drag copy).
- Delete: confirm dialog with court name in title.

## Responsive Behavior

- Mobile: stack court cards in session sort order (do not pin actionable courts to top).
- Tablet / desktop: grid or vertical stack per `court-board.md`.

## Content Rules

- Show players by team pair, not as a flat list.
- Idle open courts stay visible with four empty slots — severity of idle capacity is intentional.
- Do not duplicate roster in a footer match summary when roster is visible.

## Testing Expectations

- Idle open: 0/4, four `Empty` slots, guidance copy, no `Drop player here`.
- Assigned / in progress: primary footer CTA, flat player tokens, `vs` divider.
- Delete from overflow menu with confirmation.
- No duplicate **Add court** inside pegboard `CourtBoard` (zone header only).

## Anti-Patterns

- Duplicate **Add court** in zone header and board body.
- Red **Delete court** button under every open card.
- `Drop player here` on idle courts before P5 exists.
- Nested bordered mini-cards inside slots.
- Pinning actionable courts to top of list.
- Hiding idle open courts to reduce visual noise.
