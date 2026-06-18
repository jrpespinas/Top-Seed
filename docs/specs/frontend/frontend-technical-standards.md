# Frontend Technical Standards

## Purpose

This spec translates the UX direction in `docs/specs/frontend/design-system.md` into implementation rules. Use it when building frontend components, screens, styling utilities, design tokens, and responsive behavior.

The design system defines how Top Seed should feel. This file defines how that intent should be implemented consistently in code.

For library choices and dependency guidance, use `docs/specs/frontend/frontend-stack.md`.

## Core Rules

- Prefer semantic design tokens over raw values.
- Prefer `rem`, `em`, `%`, `fr`, `svh`, `lvh`, `dvh`, `vw`, and container-relative units over `px`.
- Use raw `px` only for hairline borders, icon source dimensions, and unavoidable media asset constraints.
- Build tablet-first organizer components, then adapt down to mobile and up to desktop.
- Keep reusable UI components domain-agnostic; keep badminton-specific behavior in feature components.
- Avoid one-off styling in feature screens when a reusable token, variant, or component exists.
- Keep live session workflows local-first. UI actions should not require immediate network success to update the organizer's working session.

## CSS Units

Preferred units:

- `rem`: typography, spacing, radius, component dimensions, touch targets.
- `em`: component-internal spacing that should scale with local font size.
- `%`: fluid widths and proportional layout.
- `fr`: grid layout.
- `svh`, `lvh`, `dvh`: viewport-height layouts, especially mobile screens with browser chrome.
- `vw`: rare full-width layout treatments, not text sizing.
- `ch`: readable text measure where helpful.

Allowed `px` usage:

- `1px` borders.
- Icon viewbox or source asset dimensions.
- Exact image crop constraints.
- Canvas or chart primitives if needed later.

Avoid:

- Raw pixel font sizes such as `font-size: 14px`.
- Arbitrary spacing such as `margin-top: 13px`.
- Viewport-width text sizing for normal app UI.
- Hardcoded component heights that break with text wrapping.

## Design Tokens

Define tokens before building repeated components. Token names should describe purpose, not appearance alone.

Token groups:

- `--color-*`
- `--text-*`
- `--font-*`
- `--space-*`
- `--radius-*`
- `--shadow-*`
- `--border-*`
- `--size-*`
- `--z-*`
- `--motion-*`

Example token direction:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 0.875rem;
  --space-6: 1.25rem;
  --space-8: 1.75rem;

  --text-body: 0.875rem;
  --text-caption: 0.75rem;
  --text-title: 1rem;

  --radius-control: 0.375rem;
  --radius-card: 0.75rem;
}
```

Rules:

- Components should consume tokens, not define private magic numbers.
- Add a token only when a value repeats or represents a product-level decision.
- Prefer semantic color tokens such as `--color-warning-surface` over literal names such as `--color-yellow-200` in component code.
- If using a utility CSS framework, map the theme to these semantic roles.

## Typography Scale

Use semantic roles instead of ad hoc font sizes.

Recommended roles:

- `display`: high-emphasis numbers or dashboard hero status.
- `heading`: page and major section headings.
- `title`: card titles, court labels, match titles.
- `body`: default readable text.
- `label`: form labels, compact action labels.
- `caption`: metadata, timestamps, helper text.
- `numeric`: scores, money, queue positions, wait times.

Rules:

- Use `rem` for all font sizes.
- Use unitless line-height.
- Use tabular numbers for scores, money, timers, court numbers, and queue positions.
- Avoid tiny uppercase text for important status.
- Do not set fixed text containers that fail when player names are long.

Suggested starting scale:

```text
caption: 0.75rem / 1.4
body:    0.875rem / 1.5
label:   0.8125rem / 1.3
title:   1rem / 1.35
heading: 1.25rem / 1.25
display: 1.625rem / 1.15
```

Dashboard pegboard surfaces use the same scale; density comes from tighter card padding and zone gaps, not smaller touch targets on primary actions.

## Spacing Scale

Use tokenized spacing for padding, margin, gaps, and layout offsets.

Suggested base scale:

```text
0: 0
1: 0.25rem
2: 0.5rem
3: 0.75rem
4: 1rem
5: 1.25rem
6: 1.5rem
8: 2rem
10: 2.5rem
12: 3rem
16: 4rem
```

Rules:

- Use `gap` for layout spacing instead of child margins where possible.
- Keep card padding consistent across similar dashboard regions.
- Use tighter spacing for metadata groups and larger spacing between decisions.
- Do not introduce one-off spacing values without adding a token or documenting why.

## Breakpoints And Containers

Primary surfaces:

- Mobile portrait: quick organizer actions and courtside session updates.
- Tablet landscape: primary organizer dashboard.
- Desktop: setup, review, broader context.

Suggested breakpoints:

```text
mobile: 0rem to 47.999rem
tablet: 48rem to 63.999rem
desktop: 64rem and up
wide: 90rem and up
```

Rules:

- Prefer container queries for reusable dashboard components.
- Use viewport breakpoints for page-level layout changes.
- Avoid maintaining separate mobile and desktop components for the same behavior.
- Do not render operational data tables on mobile unless rows collapse into readable cards.

## Touch Targets

Minimum target sizes:

- Standard controls: `2.75rem`.
- Courtside primary actions: `3rem`.
- Icon-only controls: `2.75rem` with accessible label.
- Dense desktop-only controls: `2.25rem` minimum, only outside primary courtside flows.

Rules:

- Touch target size includes padding and clickable area, not just visual icon size.
- Keep destructive actions separated from high-frequency actions.
- Avoid hover-only controls for organizer workflows.

## Component Sizing

Repeated components should support clear size variants instead of arbitrary dimensions.

Recommended variants:

- `compact`: dense metadata lists, desktop summaries, secondary rows.
- `default`: normal mobile and tablet interaction.
- `large`: courtside primary actions, active match cards, current player status.

Rules:

- Component variants should be named by use, not by pixel size.
- If a component needs more than three size variants, revisit the component boundary.
- Prefer content-driven height with minimum size over fixed height.

## Styling Approach

Rules:

- Centralize tokens in one theme layer.
- Use Tailwind CSS as the default styling system, configured around project semantic tokens.
- Use Radix UI for accessible behavior primitives where applicable.
- Keep reusable UI components in `components/ui` visually consistent, custom-styled, and domain-agnostic.
- Keep feature-specific composition in `features/*`.
- Avoid inline styles except for dynamic values that cannot be represented by classes or CSS variables.
- Do not duplicate status color logic across components. Centralize status-to-token mapping.
- Use class composition helpers when variants become conditional.
- Do not import generic prebuilt kit visuals directly into product surfaces.

Acceptable styling systems:

- Tailwind with a project theme.
- Vanilla CSS with tokens.
- Component variant utilities.
- CSS modules only for isolated cases where Tailwind tokens are insufficient.

The chosen styling system should still follow this spec.

Component-library guidance:

- Build custom components on top of Tailwind tokens and Radix primitives.
- shadcn-style structure is acceptable as an implementation pattern, but default shadcn visuals should be replaced by project tokens.
- Avoid Material UI and Ant Design for MVP UI unless a future requirement explicitly changes the product direction.
- Keep `CourtCard`, `PlayerRow`, `MatchCard`, `OfflineBanner`, and `SyncStatusBadge` custom.

## Responsive Implementation

Rules:

- Use flex and grid layout primitives before custom measurement code.
- Use `minmax()` and `auto-fit` or `auto-fill` for responsive card grids when appropriate.
- Keep dashboard panels independently scrollable only when it improves courtside use.
- Avoid nested scroll regions on mobile unless the interaction is tested.
- Keep sticky primary actions available in drawers and long mobile forms.

## Offline Technical Standards

MVP v1 should be PWA-ready and local-first for live session operations.

Storage guidance:

- Use a durable browser storage layer suitable for structured session data, such as IndexedDB through a small wrapper.
- Do not rely on `localStorage` for the primary session database.
- Keep an in-memory view model derived from the durable local store.
- Persist active session data, player records, courts, check-ins, matches, payments, leaderboard cache, match history cache, and sync outbox actions.

Sync outbox rules:

- Every offline-capable mutation writes local state first and creates a sync action.
- Sync action names and payloads must come from `docs/specs/backend/sync-actions.md`.
- Each sync action needs a client-generated ID.
- Retry failed actions with backoff when connectivity returns.
- Preserve failed actions until the organizer retries or resolves them via `SyncReviewPanel`.
- Sync acknowledgement should mark local records as synced without replacing unsaved in-progress form state.

PWA and network rules:

- Cache the application shell so the organizer can reopen the app during poor connectivity.
- Show an offline state when network requests fail or browser connectivity is unavailable.
- Do not block live session actions only because the backend is unreachable.
- Warn the organizer when unsynced local changes exist before risky actions such as clearing local data.

### Local backup export (deferred)

MVP v1: **no** export/download implementation. Aligns with `design-system.md` and `sync-review-panel.md`.

Future: optional export of local session snapshot + outbox when sync remains failed for an extended period. Define format in a dedicated spec before UI ships.

Testing expectations:

- Reloading the page during an active session does not lose local session data.
- Actions taken offline appear immediately and remain after reload.
- Pending actions sync after reconnect.
- Failed sync actions are visible and retryable.
- Polling or sync acknowledgement does not erase in-progress form input.

## Accessibility Baseline

Every interactive component must support:

- Keyboard navigation.
- Visible focus states.
- Accessible name.
- Disabled and loading states where relevant.
- Screen-reader-safe status updates for async actions.

Rules:

- Status must not rely on color alone.
- Dialogs must trap focus and restore focus on close.
- Use semantic buttons for actions and links for navigation.
- Respect `prefers-reduced-motion`.
- Maintain sufficient contrast for text, badges, controls, and focus rings.

## Icons

Rules:

- Icons support labels; they do not replace labels for critical actions.
- Icon-only buttons require accessible labels.
- Use a consistent icon set.
- Avoid decorative sports icons in dense operational views.
- Do not use different icons for the same concept across screens.

## Motion

Motion should clarify state changes, not decorate the app.

Allowed:

- Short transitions for drawer entry, dialog entry, row expansion, and status changes.
- Subtle loading indicators.
- Reduced-motion alternatives.

Avoid:

- Decorative loops.
- Bouncy sports-themed transitions.
- Animations that delay courtside actions.
- Motion as the only indication that a state changed.

Suggested timing:

- Fast state feedback: `100ms` to `150ms`.
- Drawer or dialog transitions: `150ms` to `250ms`.
- Avoid transitions longer than `300ms` in operational flows.

## Formatting

Use shared formatters for:

- Scores.
- Money.
- Wait time.
- Match timestamps.
- Session dates.
- Rating display.
- Win rate.

Rules:

- Do not format money by string concatenation in components.
- Show session times in the organization's timezone.
- Use compact wait-time labels such as `12 min` instead of full sentences in dense lists.
- Round ratings consistently according to the rating spec.
- Keep formatter output predictable for tests.

## Forms

Rules:

- Labels are required even when placeholders are present.
- Validation messages should be close to the field.
- Preserve user input after failed submissions.
- Use native input types where possible.
- Keep courtside forms short and task-specific.
- Avoid modal form chains where one dialog opens another dialog.

## Testing Expectations

Frontend implementation tests should cover:

- Responsive rendering for dashboard-critical components.
- Keyboard behavior for dialogs, drawers, and menus.
- Status badge text and accessible labels.
- Payment and queue status visual mappings.
- Formatting helpers for money, time, scores, ratings, and dates.
- Reduced-motion behavior for animated components when practical.

## Review Checklist

Before merging frontend UI work:

- No raw pixel font sizes or arbitrary pixel spacing.
- Repeated values are represented as tokens or documented exceptions.
- Controls meet touch target guidance.
- Status is readable without color.
- Mobile layout avoids table overflow.
- Components use existing variants before adding new ones.
- Copy follows `docs/specs/frontend/design-system.md`.
- Feature components follow `docs/specs/frontend/component-architecture.md`.
