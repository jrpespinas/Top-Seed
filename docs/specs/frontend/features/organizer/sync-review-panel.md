# SyncReviewPanel

## User Job

When sync fails or many actions are pending, help the organizer understand what did not reach the server and recover without losing courtside work.

**Efficient MVP pattern:** a drawer/sheet opened from `OfflineBanner` or `SessionHeader`, not a separate route. Keeps the live dashboard in context on phone and tablet.

Future: a dedicated sync review page is optional if failure volume justifies it. Do not build a separate route in MVP.

## Data Required

- `connectionStatus`
- Sync outbox actions for the active session (and organization-scoped player actions when relevant)
- Per action: `id`, `type`, plain-language label, `status` (`pending`, `syncing`, `synced`, `failed`, `blocked`)
- `createdAt`, `retryCount`, `lastError` (code + message)
- Blocked actions: `blockedByActionId` and dependency reason
- Summary counts: pending, failed, blocked

## Child Components

- `Drawer`
- `DataList`
- `Button`
- `StatusBadge`
- `SyncStatusBadge`
- `EmptyState`

## Action List UX

Group actions in this order:

1. **Failed** — needs organizer attention first
2. **Blocked** — explain dependency on a failed parent action
3. **Pending** — waiting to sync; usually no action needed

Each row shows:

- Plain label (for example `Mark Ana paid`, `Send match to Court 2`, `Add Queue 2`)
- Entity context (player name, court name, lane name when available)
- Error message in plain language for failures
- `Retry` for failed rows
- `Blocked` badge with reason such as `Waiting on check-in sync`

Header actions:

- `Retry all failed` when `failedCount > 0`
- `Close`

Do **not** show raw JSON payloads or internal action IDs to organizers in MVP.

## Actions Emitted

- `onRetryAction` — `{ actionId }`
- `onRetryAllFailed`
- `onClose`

### MVP scope (recommended)

Include:

- Retry individual failed action
- Retry all failed actions
- View blocked actions with plain-language dependency reason

Exclude from MVP UI:

- **Discard failed action** — too easy to lose real session data; defer until export/recovery story is stronger
- **Export session backup** — defer per `docs/specs/frontend/frontend-technical-standards.md`; do not promise in sync review until format is specified

`OfflineBanner` may keep `onExportBackup` as a future hook only; hide control in MVP.

## Session Mode

- Available whenever the session has pending or failed sync actions, including live and ended sessions (recovery before leaving the venue).
- Read-only session rules do not block sync review; retrying failed mutations is recovery, not live queue operation.

## States

- No issues (drawer should not open; parent shows synced state).
- Pending only.
- Failed actions present.
- Blocked actions present.
- Retry in progress (per row or global).
- Retry succeeded (row moves to synced or disappears from failed list).
- Retry failed again (update message; keep row).
- Offline (allow retry when online; show `Will retry when back online` for pending).

## Responsive Composition

- Mobile: full-height bottom sheet with scrollable action list; sticky `Retry all failed` and `Close`.
- Tablet and desktop: right drawer; list scrolls independently.

## Entry Points

- `SessionHeader` → `onReviewSyncIssues`
- `OfflineBanner` → `onReview`
- `SyncStatusBadge` tap on failed session-level state (optional shortcut)

## Copy Guidelines

- Failed: `Could not sync: Mark Ana paid. Court 2 is already occupied.`
- Blocked: `Waiting on an earlier change before this can sync.`
- Pending: `Waiting to sync.`
- Retry all: `Retry 3 failed changes`

## Acceptance Criteria

- Organizer can open sync review from banner or header without route change.
- Failed actions appear before pending actions.
- Blocked actions show which earlier failure blocked them.
- Retry one and retry all enqueue sync retry using the same outbox records.
- Dashboard remains visible behind the drawer on tablet and desktop.
- No discard or export backup buttons in MVP.
- Plain-language labels; no developer error codes as the only message.
