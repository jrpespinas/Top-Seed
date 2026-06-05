# Button

## Purpose

Triggers a clear user action. Buttons are the primary way organizers and players perform workflow steps such as checking in, accepting suggestions, starting matches, and marking payments.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`

## When To Use

- Use for actions that change state, submit forms, open dialogs, or start workflows.
- Use the primary variant for the most important next action in a section.

## When Not To Use

- Do not use for navigation to another route; use a link component.
- Do not use icon-only buttons for critical courtside actions unless paired with visible text elsewhere.

## Props Or Data Contract

- `children`: visible label.
- `variant`: `primary`, `secondary`, `tertiary`, `danger`, or `ghost`.
- `size`: `compact`, `default`, or `large`.
- `isLoading`: prevents duplicate submission and shows progress.
- `disabled`: blocks interaction.
- `type`: `button`, `submit`, or `reset`.
- `onClick`: action callback.

## States

- Default, hover, focus, disabled, loading, and pressed.
- Loading state must preserve button width and prevent double taps.

## Accessibility

- Must have a readable label.
- Must be keyboard reachable.
- Focus ring must be visible.
- Disabled state must be programmatically disabled, not only visually muted.

## Responsive Behavior

- Use `large` for courtside primary actions on tablet and mobile.
- Buttons may become full-width in narrow mobile forms.

## Content Rules

- Use verbs: `Mark paid`, `Finish match`, `Accept suggestion`.
- Avoid technical labels such as `Submit mutation`.

## Testing Expectations

- Renders all variants and sizes.
- Calls action once per click or submit.
- Blocks interaction while loading or disabled.
- Exposes accessible name.

## Anti-Patterns

- Multiple primary buttons in the same decision area.
- Destructive action next to high-frequency primary action without spacing or confirmation.
