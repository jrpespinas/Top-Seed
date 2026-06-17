# Drawer

## Purpose

Provides focused side-task editing without leaving the current page or losing dashboard context.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for player details, payment updates, check-in forms, rating adjustments, and match details.
- Player session + profile editing: compose `PlayerDetailDrawer` inside `Drawer` per `features/organizer/player-detail-drawer.md`.

## When Not To Use

- Do not use for destructive confirmations; use `Dialog`.
- Do not put unrelated multi-step flows in one drawer.

## Props Or Data Contract

- `isOpen`: visibility state.
- `title`: required drawer title.
- `description`: optional helper text.
- `children`: drawer content.
- `footerActions`: sticky action region.
- `side`: `right` or `bottom`.
- `onOpenChange`: close handler.

## States

- Opening, open, closing, dirty form, loading, and error.

## Accessibility

- Must be keyboard reachable.
- Should trap focus when modal.
- Restore focus to trigger on close.
- Sticky footer actions must remain accessible.

## Responsive Behavior

- Mobile: bottom drawer or full-height sheet.
- Tablet and desktop: right-side drawer for dashboard context.

## Content Rules

- Title should describe the object: `Edit payment`, `Player details`.
- Keep forms short and task-specific.

## Testing Expectations

- Opens and closes correctly.
- Preserves entered form state during validation errors.
- Footer action remains reachable on mobile.

## Anti-Patterns

- Nested drawers.
- Hiding primary dashboard state behind a full-screen drawer when a side drawer would work.
