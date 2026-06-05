# SyncStatusBadge

## Purpose

Shows whether data or an action is local-only, pending sync, syncing, synced, or failed.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/backend/domain-model.md`

## When To Use

- Use near records or panels affected by local-first sync state.
- Use on payment rows, match cards, court actions, session header, and failed sync review surfaces.

## When Not To Use

- Do not show a badge on every record when the whole page is already clearly synced.
- Do not use for domain status such as `playing` or `paid`; use `StatusBadge` or `PaymentBadge`.

## Props Or Data Contract

- `status`: `local`, `pending`, `syncing`, `synced`, or `failed`.
- `pendingCount`: optional count for grouped pending actions.
- `lastSyncedAt`: optional timestamp.
- `lastError`: optional error text for failed state.
- `size`: `compact`, `default`, or `large`.

## States

- `local`: saved only on this device.
- `pending`: waiting for connectivity or sync turn.
- `syncing`: currently sending.
- `synced`: acknowledged by backend.
- `failed`: needs organizer attention.

## Accessibility

- Status text must be readable.
- Failed state must not rely only on color.
- Timestamps should use shared date/time formatters.

## Responsive Behavior

- Mobile: compact label with optional count.
- Tablet and desktop: may include last sync timestamp in summary areas.

## Content Rules

- Use calm labels: `Pending sync`, `Saved on this device`, `Sync failed`.
- Avoid alarming copy unless local data is truly at risk.

## Testing Expectations

- Renders all sync statuses.
- Displays pending count when provided.
- Displays failed error accessibly when provided.

## Anti-Patterns

- Treating normal offline pending state as an error.
- Hiding failed sync actions from the organizer.
