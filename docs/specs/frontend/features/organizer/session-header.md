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
- `SyncStatusBadge`
- `StatusBadge`
- `SyncReviewPanel`

Do **not** compose `OfflineBanner` in the header when sync is healthy — that belongs in `AttentionRail` (failure/offline only). See `live-dashboard-layout.md` and `attention-rail.md`.

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

Desktop session chrome (one compact block, not stacked bands):

1. **Row 1:** Back link (`← Sessions`) + session title (H1) + meta line (venue · time · fee · courts) + status chips (`Active`, `SyncStatusBadge`).
2. **Row 2:** Secondary navigation — segmented links or overflow menu (`···` → Players, Payments, History, Leaderboard). Not a third full-width nav band competing with pegboard zones.
3. **Complete session** is **not** a prominent destructive button in the header on desktop. Place in `SupportingStrip` (text link) or overflow menu; `ConfirmAction` unchanged.

Sync visibility:

| Sync state | Header | AttentionRail |
|------------|--------|---------------|
| Synced, online | `SyncStatusBadge` chip only | Hidden |
| Syncing | Chip “Syncing…” | Optional thin line |
| Failed / blocked | Chip + Review action | Full rail with Review |
| Offline + pending | Chip “Offline” | `OfflineBanner` content in rail |

Do **not** show `SyncStatusBadge` and a full green “All changes synced” banner at the same time.

- Mobile: stack title, status chip, and overflow for complete session.
- Tablet: title left, status and overflow right.
- Desktop: single-row chrome as above; metadata inline.

Hide `ApiStatusBanner` on the live dashboard when API is healthy (dev/diagnostic on sessions list only).

## Acceptance Criteria

- Session identity is clear at a glance.
- Connection and sync status are visible without blocking session operation.
- When synced, sync is indicated by **badge only** — no duplicate success banner.
- Completing or cancelling a session requires confirmation.
- Complete session is not the most visually prominent control on the dashboard.
- Completed and cancelled sessions do not show live operation actions.
- No Share session button in MVP v1.
- No role or permission-level badge in MVP v1.
