# SessionWorkspaceShell

## User Job

Give every session sub-route the same immersive chrome, sync wiring, and not-found handling without duplicating header markup on payments, history, and future session pages.

## When to Use

| Route pattern | Shell |
|---------------|-------|
| `/organizer/sessions/:sessionId/dashboard` | Compose `SessionWorkspaceBar` directly (dashboard also renders `AttentionRail`, pegboard, mobile tabs) |
| `/organizer/sessions/:sessionId/payments` | `SessionWorkspaceShell` with `activeView="payments"` |
| `/organizer/sessions/:sessionId/history` | `SessionWorkspaceShell` with `activeView="history"` |
| `/organizer/sessions/:sessionId/players` | Redirect to dashboard in MVP v1 — no dedicated shell |

Do **not** nest `SessionWorkspaceShell` inside the live dashboard page. The dashboard owns pegboard layout below the bar.

## App Shell Interaction

On session workspace routes (`dashboard`, `payments`, `history`, `players`):

- The **root app header** (global Top Seed + Sessions / Leaderboard nav) is **hidden**.
- `SessionWorkspaceBar` supplies branding (`Top Seed` · `Sessions`) and session context.
- Main content uses the wider session max-width (`max-w-[1400px]`) and tighter vertical padding than non-session routes.

See `session-header.md` and `component-architecture.md`.

## Data Required

Provided by `useSessionChrome(sessionId)`:

- `session` — local session row from Dexie.
- `courtCount` — non-deleted courts for the session.
- `sessionMode` — `live` | `ended` from session status.
- Sync summary: `syncStatus`, `pendingCount`, `blockedCount`, `lastSyncedAt`, `connectionStatus`.
- `retry` — retry failed sync actions.
- `openSyncReview` — open `SyncReviewPanel`.
- `syncReviewPanel` — rendered drawer node (append after page children).

## Props

```text
sessionId: string
activeView: "dashboard" | "payments" | "history" | "players"
children: ReactNode
sticky?: boolean  // default true
```

`activeView` drives:

- Suffix on session title (`· Payments`, `· History`, `· Players`).
- Overflow menu filtering (hide the current route’s destination).

## Child Components

- `SessionWorkspaceBar`
- `SyncReviewPanel` (via `useSyncReviewDrawer` inside `useSessionChrome`)

Pages compose their own feature content as `children`. Do **not** add page-level `SessionSyncBar`, duplicate `SessionHistoryHeader`, or standalone `OfflineBanner` when the shell is used — sync visibility lives in the bar badge and `AttentionRail` on the dashboard.

## States

| State | Behavior |
|-------|----------|
| Session missing locally | Render “Session not found” card; no workspace bar |
| Session loaded | Bar + children + sync review overlay |
| Ended session | Bar shows read-only chip; page content follows session mode rules |

## Actions Emitted

The shell does not emit workflow actions. Navigation is handled inside `SessionWorkspaceBar` overflow links.

## Acceptance Criteria

- Payments and history pages share one chrome implementation.
- Sync review drawer mounts once per page without duplicate sync hooks in page bodies.
- Missing session shows a clear empty state without a broken header.
- `activeView` correctly labels the current sub-route in the bar title.
- No duplicate global app header on session workspace routes.

## Related Specs

- `session-header.md` — `SessionWorkspaceBar` layout and overflow menu
- `live-dashboard-layout.md` — dashboard-specific regions below the bar
- `sync-review-panel.md` — drawer opened from chrome or attention rail
