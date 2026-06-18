# SessionWorkspaceBar

Canonical component: **`SessionWorkspaceBar`**. `SessionHeader` is a **deprecated alias** — do not use in new specs or code.

Shell wrapper for sub-routes: `session-workspace-shell.md`.

## User Job

Help the organizer identify the active session, see sync health at a glance, and reach secondary session routes without sacrificing pegboard height.

MVP access rules: `docs/specs/mvp-access.md`.

## Immersive Workspace Chrome

On `/organizer/sessions/:sessionId/{dashboard|payments|history|players}`:

- **Hide** the global app header (Top Seed + Sessions / Leaderboard / Components).
- Render one **sticky** `SessionWorkspaceBar` instead of stacked title + sub-nav pills.
- **Remove** the separate Players nav link; check-in lives on the dashboard. `/players` redirects to dashboard.
- Use wider main shell (`max-w-[1400px]`) on these routes.

### Bar layout

Single header row + optional meta line:

| Left | Right |
|------|-------|
| `Top Seed` · `Sessions` · session name · optional `· Payments/History` | Session status chip · `SyncStatusBadge` · `···` overflow |

- `Top Seed` and `Sessions` link back to `/organizer/sessions`.
- Session name truncates on narrow widths.
- Meta line (venue · date/time · fee · court count) shows inline on `lg+`; below title on smaller breakpoints.

### Overflow menu (`···`)

Items (current route omitted):

- Live dashboard
- Payments
- Match history
- Leaderboard (this session) → `/organizer/leaderboard?sessionId=`
- All sessions

Trigger: `IconButton` labeled **Session menu** with `MoreHorizontal` icon.

## Data Required

| Prop | Source |
|------|--------|
| `session` | Local session row |
| `courtCount` | Active courts for session |
| `sessionMode` | `live` or `ended` |
| `syncStatus`, `pendingCount`, `blockedCount`, `lastSyncedAt` | Sync hook / `useSessionChrome` |
| `activeView` | Current workspace route |
| `sticky` | Default `true` |

Do not require in MVP v1:

- Organizer permission level or role badge.

## Child Components

- `Link` (TanStack Router) — branding crumbs
- `SyncStatusBadge`
- `DropdownMenu`
- `IconButton`

Do **not** compose in the bar:

- `OfflineBanner` when sync is healthy — failures belong in `AttentionRail` on the dashboard (see `attention-rail.md`).
- `ConfirmAction` for complete/cancel session — those live in `SupportingStrip` or session settings flows, not the bar.
- Sub-nav pill row (Players / Payments / History / Leaderboard).

## Actions (Navigation Only)

Navigation is internal via overflow `DropdownMenu` items. The bar does **not** expose:

- `onEditSession`
- `onCompleteSession`
- `onCancelSession`
- `onShareSession` (future)

Sync recovery:

- `SyncStatusBadge` reflects state; **Review** for failures is triggered from `AttentionRail` on the dashboard or from the sync review entry wired in `useSessionChrome` / `SyncReviewPanel`.

## Session Mode

| Session status | Bar behavior |
|----------------|--------------|
| `draft`, `open`, `active` | Status chip shows live label (e.g. Active); no read-only suffix |
| `completed`, `cancelled` | Chip + `· Read-only` suffix; overflow navigation still works |

Complete session is **not** a primary control in the bar. Use `SupportingStrip` on the dashboard.

## States

- Loading session (shell shows not-found until Dexie row exists).
- Active session.
- Draft/open session.
- Completed/cancelled read-only session.
- Offline with pending local changes (badge reflects pending count).
- Sync failed with recoverable actions (badge + attention rail on dashboard).

## Sync Visibility

| Sync state | Bar | AttentionRail (dashboard only) |
|------------|-----|--------------------------------|
| Synced, online | `SyncStatusBadge` chip only | Hidden |
| Syncing | Chip “Syncing…” | Optional thin line |
| Failed / blocked | Chip with count | Full rail with Review |
| Offline + pending | Chip reflects offline/pending | `OfflineBanner` content in rail |

Do **not** show `SyncStatusBadge` and a full green “All changes synced” banner at the same time.

Hide `ApiStatusBanner` on session workspace routes when API is healthy (dev/diagnostic on sessions list only).

## Responsive Composition

**Session workspace routes:**

1. No global app header.
2. Sticky `SessionWorkspaceBar` with overflow for secondary routes.
3. No always-visible Players / Payments / History / Leaderboard pill row.

**Live dashboard** adds `AttentionRail` below the bar when needed, then the pegboard. Mobile keeps bottom tabs below chrome.

**Payments / history:** bar + page content only; no pegboard.

### Deprecated pattern (do not ship)

```text
❌ Row 1: Back + H1 title + meta + chips + Complete session button
❌ Row 2: Players · Payments · History · Leaderboard pills
❌ Duplicate SessionSyncBar below the bar on sub-pages
```

## Acceptance Criteria

- Session identity is clear at a glance.
- Connection and sync status are visible without blocking session operation.
- When synced, sync is indicated by **badge only** — no duplicate success banner.
- Complete session is not in the workspace bar.
- Completed and cancelled sessions show read-only labeling in the bar.
- No Share session button in MVP v1.
- No role or permission-level badge in MVP v1.
- Overflow menu exposes payments, history, and session-scoped leaderboard without a pill row.
