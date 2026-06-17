# DropdownMenu

## Purpose

Shows a compact menu of secondary actions triggered from a button or icon, without leaving the current dashboard context.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for overflow actions on queue lane headers, court cards, player rows, and match cards.
- Use when there are two to eight related actions that should not all be visible as buttons.
- Use for lane actions such as `Rename` and `Delete` in `QueueLaneManagement`.

## When Not To Use

- Do not use for primary courtside actions; keep those as visible buttons.
- Do not use for navigation to another route as the only pattern; pair with clear labels.
- Do not use for destructive-only flows without confirmation; destructive items still require `ConfirmAction` or `Dialog`.

## Props Or Data Contract

- `trigger`: button or `IconButton` that opens the menu.
- `items`: ordered menu entries.
- `item.label`: required visible text.
- `item.onSelect`: action callback.
- `item.disabled`: optional; include reason in `aria-describedby` when helpful.
- `item.destructive`: optional visual emphasis for delete/remove actions.
- `item.icon`: optional leading icon.
- `align`: `start`, `center`, or `end` relative to trigger.
- `side`: `top`, `right`, `bottom`, or `left`.

## States

- Closed, open, item hover/focus, disabled item, and loading item (optional).

## Accessibility

- Trigger must have an accessible name such as `Queue lane actions` or `More actions for Court 2`.
- Menu must be keyboard navigable with arrow keys and Escape to close.
- Return focus to trigger on close.
- Destructive items must be readable text, not color-only.

## Responsive Behavior

- Mobile: prefer bottom-anchored menu or full-width touch targets for menu items.
- Tablet and desktop: align to trigger; avoid menus that open off-screen.

## Content Rules

- Use verb phrases: `Rename lane`, `Delete lane`, `Mark resting`.
- Do not use implementation terms such as `PATCH check-in`.
- Group related items with separators when the menu has more than five entries.

## Testing Expectations

- Opens and closes from trigger and Escape.
- Fires `onSelect` once per item activation.
- Disabled items are not activatable.
- Keyboard navigation reaches all items.

## Anti-Patterns

- Hiding the only way to complete a critical workflow inside a menu with no visible alternative.
- Nested submenus deeper than one level in MVP.
- Icon-only menu items without accessible names.
