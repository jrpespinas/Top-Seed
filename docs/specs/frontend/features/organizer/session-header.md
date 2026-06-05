# SessionHeader

## User Job

Help the organizer identify the active session and access high-level session actions.

## Data Required

- Session name, venue, date/time, status, fee, and court count.
- Current organizer permission level.
- Connection status, sync status, pending action count, failed action count, and last synced time.

## Child Components

- `Button`
- `ConfirmAction`
- `OfflineBanner`
- `SyncStatusBadge`
- `StatusBadge`

## Actions Emitted

- `onEditSession`
- `onShareSession`
- `onCompleteSession`
- `onCancelSession`
- `onRetrySync`
- `onReviewSyncIssues`

## Permissions

- Only `owner` and `organizer` can edit, complete, or cancel sessions.

## States

- Loading session.
- Active session.
- Draft/open session.
- Completed/cancelled read-only session.
- Permission denied actions hidden or disabled.
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
