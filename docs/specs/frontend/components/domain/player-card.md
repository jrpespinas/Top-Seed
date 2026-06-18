# PlayerCard

## Purpose

Card variant of the player token for the Player List zone. Shows avatar, name, skill, status, session stats, and row actions in a glanceable card layout.

## Source Specs

- `docs/specs/frontend/design-system.md` — Reference-inspired card system
- `components/domain/player-row.md` — shared data contract and actions

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

- `default`: full card with avatar, badges, stats footer, overflow menu.
- `compact`: smaller padding; used inside match team columns.

## States

- Waiting, resting, assigned, playing, done, removed, skipped from suggestions, unpaid payment badge.

## Accessibility

- Avatar is decorative; name is the accessible label.
- Overflow menu exposes all row actions with keyboard access.

## Testing Expectations

- Renders name, skill, and status badge.
- Compact variant fits inside match card grid.
- Actions mirror `PlayerRow` behavior.
