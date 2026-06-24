# PlayerCard

## Purpose

Card variant of the player token for the Player List zone. Shows name, skill, status, session stats, and row actions in a glanceable card layout. No avatar in MVP — photo support is future work.

## Source Specs

- `docs/specs/frontend/design-system.md` — Reference-inspired card system
- `components/domain/player-row.md` — shared data contract and actions
- `features/organizer/desktop-drag-and-drop.md` — optional drag handle and `player` drag source

## When To Use

- Desktop pegboard `QueuePanel` list.
- Nested inside `MatchCard` team columns (compact variant).
- Optional compact token inside court team slots.

## When Not To Use

- Dense mobile lists where `PlayerRow` is sufficient.
- Payment summary tables.

## Props Or Data Contract

Same as `PlayerRow` plus:

- `variant`: `default` | `compact`
- `queuePosition`: optional number for `Queued #n` label
- `showStats`: optional; games played and wait duration

## Variants

- `default`: full card with name + edit pencil, skill/status badges, stats footer (games, wins, elapsed time), drag handle, remove.
- `compact`: name-only token for drag overlay previews.

## States

- Waiting, resting, assigned, playing, done, removed, skipped from suggestions, unpaid payment badge.

## Accessibility

- Avatar is not shown in MVP v1.
- Name is the accessible label; edit pencil opens player details.

## Testing Expectations

- Renders name, skill, and status badge.
- Compact variant fits inside match card grid.
- Actions mirror `PlayerRow` behavior.
