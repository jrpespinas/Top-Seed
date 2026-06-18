# AttentionRail

## User Job

Surface **exceptions only** on the live dashboard — unpaid players, sync failures, offline pending work — without turning the page into a six-tile analytics strip.

Replaces the always-visible `SessionStatusBar` metric row on **desktop** (≥1280px). Mobile may still use compact metrics on the **More** tab.

## Data Required

- `unpaid` count (from session payment summary / check-ins).
- `openCourts` count (optional inline hint when all courts busy — future stretch).
- `waiting` count (optional — prefer zone context over global tile).
- Sync: `connectionStatus`, `syncStatus`, `pendingCount`, `failedCount`, `blockedCount`.
- `lastSyncedAt` (optional footnote in expanded failure state).

## Child Components

- `OfflineBanner` (when offline, pending, or failed — **not** when fully synced)
- `Button` / text links for Review and View payments
- `PaymentBadge` (optional inline count)

Do **not** compose six equal `MetricCard` components in this rail on desktop.

## Visibility Rules

| Condition | Render AttentionRail? | Content |
|-----------|----------------------|---------|
| Synced, online, `unpaid === 0` | **No** | — |
| `unpaid > 0` | Yes | `{n} unpaid · View payments` |
| `failedCount > 0` or `blockedCount > 0` | Yes | Sync failed copy + Review |
| Offline with pending local changes | Yes | Offline banner content |
| Syncing | Optional thin “Syncing…” line | Non-blocking |

When synced and healthy, sync state appears only as **`SyncStatusBadge` in session chrome** — not a second full-width green banner.

## Actions Emitted

- `onViewPayments` → navigate to payments page or filter unpaid
- `onReviewSyncIssues` → open `SyncReviewPanel`
- `onRetrySync`
- `onFilterWaiting` (optional; prefer navigating to Available zone)

## Layout

- Full width between session chrome and pegboard.
- Single horizontal row; wrap on narrow tablet.
- Tone: `warning` surface when unpaid; `danger`/`attention` when sync failed; `info` when offline pending.

## Responsive Composition

| Breakpoint | Behavior |
|------------|----------|
| Desktop ≥1280px | Primary exception surface; no `SessionStatusBar` |
| Tablet | May combine 2–3 inline chips |
| Mobile | Defer to tab **More** + header badge; rail optional if sync failed |

## Acceptance Criteria

- Rail is **hidden** when there is nothing to act on (synced + no unpaid).
- Unpaid count is never hidden from organizers when &gt; 0.
- Sync failure is visible without opening a panel.
- Rail does not push pegboard below the fold on a 1080p display.
- Does not duplicate `SyncStatusBadge` message when state is `synced`.
