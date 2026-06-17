# OfflineBanner

## Purpose

Shows page-level connection and sync guidance when the organizer is offline, syncing, or has failed sync actions.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/components/domain/sync-status-badge.md`

## When To Use

- Use on live organizer pages when connectivity is unavailable.
- Use when there are pending or failed sync actions that affect the current session.

## When Not To Use

- Do not use for routine loading states.
- Do not interrupt with a modal for normal offline mode.

## Props Or Data Contract

- `connectionStatus`: `online` or `offline`.
- `syncStatus`: `pending`, `syncing`, `synced`, or `failed`.
- `pendingCount`: number of pending actions.
- `failedCount`: number of failed actions.
- `lastSyncedAt`: optional timestamp.
- `onRetry`: retry failed sync actions.
- `onReview`: open `SyncReviewPanel`.
- `onExportBackup`: future hook only; hide in MVP. See `sync-review-panel.md`.

## States

- Online and synced.
- Offline with no failed actions.
- Online and syncing.
- Online with pending actions.
- Sync failed.

## Accessibility

- Use a status/live region for connection changes.
- Actions must be keyboard reachable.
- Do not rely on color alone.

## Responsive Behavior

- Mobile: compact sticky banner that does not cover primary actions.
- Tablet: top-of-dashboard banner below session header.
- Desktop: banner can include last synced timestamp and action buttons.

## Content Rules

- Offline: `Offline. You can keep running this session.`
- Pending: `3 changes pending sync.`
- Synced: `All changes synced.`
- Failed: `Sync failed for 1 change. Review and retry.`

## Testing Expectations

- Renders correct message for each connection/sync state.
- Retry and review actions fire callbacks.
- Banner does not hide dashboard primary actions on mobile.

## Anti-Patterns

- Blocking the dashboard while offline.
- Showing scary error copy for normal disconnection.
- Promising export backup in MVP when no format or control exists.
