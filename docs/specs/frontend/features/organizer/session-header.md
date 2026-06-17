# SessionHeader

## User Job

Help the organizer identify the active session and access high-level session actions.

MVP access rules: `docs/specs/mvp-access.md`.

## Data Required

- Session name, venue, date/time, status, fee, and court count.
- Connection status, sync status, pending action count, failed action count, and last synced time.

Do not require in MVP v1:

- Organizer permission level or role badge.

## Child Components

- `Button`
- `ConfirmAction`
- `OfflineBanner`
- `SyncStatusBadge`
- `StatusBadge`
- `SyncReviewPanel`

## Actions Emitted

- `onEditSession`
- `onCompleteSession`
- `onCancelSession`
- `onRetrySync`
- `onReviewSyncIssues` → opens `SyncReviewPanel`

Do not emit in MVP v1:

- `onShareSession` (future player link / QR check-in; hidden in MVP)

## Session Mode

| Session status | Header behavior |
|----------------|-----------------|
| `draft`, `open`, `active` | Show live actions: edit, complete, cancel |
| `completed`, `cancelled` | Read-only; hide live operation actions |

## States

- Loading session.
- Active session.
- Draft/open session.
- Completed/cancelled read-only session.
- Offline with pending local changes.
- Sync failed with recoverable actions.

## Responsive Composition

- Mobile: stack title, status, and primary action.
- Tablet: title left, status and actions right.
- Desktop: include more metadata inline.

## Acceptance Criteria

- Session identity is clear at a glance.
- Connection and sync status are visible without blocking session operation.
- Completing or cancelling a session requires confirmation.
- Completed and cancelled sessions do not show live operation actions.
- No Share session button in MVP v1.
- No role or permission-level badge in MVP v1.
