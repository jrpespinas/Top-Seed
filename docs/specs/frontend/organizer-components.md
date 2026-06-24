# Organizer Component Spec

## Organizer UX Goal

The organizer should be able to run a badminton session from one dashboard with minimal typing and clear status at a glance.

## Canonical Component Registry

Use these names in code, specs, and UI copy. **Aliases are deprecated**—do not use them in new work.

### Pegboard zones (dashboard layout)

| Canonical | Pegboard | Aliases (deprecated) | Spec |
|-----------|----------|----------------------|------|
| `PlayerPool` | Available (display: **Player List**) | — | `features/organizer/player-pool.md` |
| `NextQueuePanel` | Next (display: **Upcoming Matches**) | `SuggestedMatchPanel`, `NextQueue` | `features/organizer/next-queue-panel.md` |
| `CourtBoard` | Now (display: **Courts**) | — | `features/organizer/court-board.md` |

### Feature components

| Canonical | Role | Spec |
|-----------|------|------|
| `SessionWorkspaceBar` | Immersive sticky session chrome | `features/organizer/session-header.md` |
| `SessionWorkspaceShell` | Shared chrome wrapper for session sub-routes | `features/organizer/session-workspace-shell.md` |
| `SessionHeader` | Deprecated alias for `SessionWorkspaceBar` | `features/organizer/session-header.md` |
| `AttentionRail` | Exception strip (unpaid, sync, offline) on desktop | `features/organizer/attention-rail.md` |
| `PegboardLayout` | Three-zone dashboard grid shell | `features/organizer/live-dashboard-layout.md` |
| `SupportingStrip` | Compact secondary row (payments teaser, links) | `features/organizer/live-dashboard-layout.md` |
| `DesktopDndProvider` | Optional desktop pegboard drag-and-drop shell | `features/organizer/desktop-drag-and-drop.md` |
| `SessionStatusBar` | Operating metrics (mobile **More** tab; deprecated desktop) | `features/organizer/session-status-bar.md` |
| `PlayerCheckInPanel` | Check-in and add player (inside `PlayerPool`) | `features/organizer/player-check-in-panel.md` |
| `QueuePanel` | Waiting/resting/done/removed list (inside `PlayerPool`) | `features/organizer/queue-panel.md` |
| `QueueLaneManagement` | Lane CRUD and lane column UI (inside `NextQueuePanel`) | `features/organizer/queue-lane-management.md` |
| `ActiveMatchPanel` | Start, score, finish, cancel match | `features/organizer/active-match-panel.md` |
| `PaymentSummaryPanel` | Payment totals and unpaid filter | `features/organizer/payment-summary-panel.md` |
| `RecentMatchesPanel` | Recent results and correction entry | `features/organizer/recent-matches-panel.md` |
| `PlayerDetailDrawer` | Session + profile detail in one drawer | `features/organizer/player-detail-drawer.md` |
| `SyncReviewPanel` | Failed/pending/blocked sync recovery | `features/organizer/sync-review-panel.md` |
| `LeaderboardView` | Organizer-visible rankings | `features/player/leaderboard-view.md` |

### Canonical action callbacks

| Canonical | Purpose | Deprecated aliases |
|-----------|---------|-------------------|
| `onAcceptSuggestion` | Stage suggestion in selected Next lane | — |
| `onMoveQueuedMatchToCourt` | Promote staged match to court | — |
| `onDirectAssignToCourt` | Skip Next staging (`CREATE_MATCH`) | — |

Removed from MVP v1 (do not implement): `onAutoFillQueue` and aliases `onAutoFillNextQueue`, `onAutoFillQueueLane`, `onAutoFillLane`.

### Canonical UI labels

| Canonical | Deprecated |
|-----------|------------|
| **Add to Next queue** / **Add to [lane name]** | Accept suggestion (when label implies court assign) |
| **Send to court** | Assign to court (for promote from lane) |
| **Magic Queue** | Accept suggestion into selected lane (pegboard footer) |

### Dashboard composition tree

```text
OrganizerSessionDashboard
├── SessionWorkspaceBar
├── AttentionRail (conditional; desktop)
├── PegboardLayout
│   ├── PlayerPool (Player List)
│   │   ├── PlayerCheckInPanel
│   │   └── QueuePanel (filter chips + PlayerCard)
│   ├── NextQueuePanel (Upcoming Matches)
│   │   └── QueueLaneManagement
│   └── CourtBoard (Courts)
├── SupportingStrip (after first check-in; desktop)
├── SessionStatusBar (mobile More tab only)
├── PlayerDetailDrawer (overlay; opened from rows)
└── SyncReviewPanel (overlay; opened from attention rail or sync review hook)

OrganizerSessionPayments / OrganizerSessionHistory
├── SessionWorkspaceShell
│   ├── SessionWorkspaceBar
│   └── SyncReviewPanel (via useSessionChrome)
└── Page feature content (payments list, history filters, etc.)
```

Full `PaymentSummaryPanel`, `RecentMatchesPanel`, and leaderboard preview are **route-level** on desktop — linked from `SupportingStrip`, not pegboard siblings.

`QueueLaneManagement` is **not** a top-level dashboard sibling. It is composed inside `NextQueuePanel`.

## Main Dashboard Composition

The live dashboard should be composed per `features/organizer/live-dashboard-layout.md`:

- `SessionWorkspaceBar` (or deprecated `SessionHeader` alias)
- `AttentionRail` (desktop exceptions)
- `PegboardLayout` wrapping `PlayerPool`, `NextQueuePanel`, `CourtBoard` (left → right)
- `SupportingStrip`
- `ActiveMatchPanel`
- `SessionStatusBar` on mobile **More** tab only
- `LeaderboardView` via `/organizer/leaderboard` link — not a full dashboard card on desktop

Detailed feature specs live in `docs/specs/frontend/features/organizer/`. Use this file as the overview and the focused feature files as the implementation contracts.

MVP player operations are organizer-managed. Do not implement player self-service check-in or player-owned profile pages for v1.

## Components

### SessionWorkspaceBar

Purpose:

- Immersive sticky session chrome on workspace routes.
- Branding crumbs, session identity, status chip, sync badge, overflow navigation.

Props:

- `session`, `courtCount`, `sessionMode`
- `syncStatus`, `pendingCount`, `blockedCount`, `lastSyncedAt`
- `activeView`, `sticky`, `className`

Rules:

- Global app header is hidden on session workspace routes.
- Complete / cancel session actions are **not** in the bar (use `SupportingStrip` on dashboard).
- Secondary routes via overflow menu, not pill row.
- `SessionHeader` is a deprecated alias — use `SessionWorkspaceBar`.

Spec: `features/organizer/session-header.md`.

### SessionWorkspaceShell

Purpose:

- Share `SessionWorkspaceBar` + `useSessionChrome` + sync review overlay across payments and history pages.

Props:

- `sessionId`, `activeView`, `children`, `sticky`

Rules:

- Do not use on the live dashboard (dashboard composes bar + pegboard directly).
- Do not duplicate `SessionSyncBar` or page-specific headers inside children.

Spec: `features/organizer/session-workspace-shell.md`.

### SessionHeader (deprecated)

Alias for `SessionWorkspaceBar`. Do not reference in new work.

### SessionStatusBar

Purpose:

- Show key operating metrics.

Metrics:

- Checked-in players.
- Waiting players.
- Active matches.
- Open courts.
- Unpaid players.
- Collected amount.

Rules:

- Use compact cards on tablet and horizontal scroll on mobile if needed.
- Do not hide unpaid count.

### CourtBoard

Purpose:

- Show all session courts and current match state.

State rules: `docs/specs/backend/state-transitions.md`.

Court card states:

- `open`
- `partiallyFilled` (derived: `occupied` + match `assigned` with incomplete roster)
- `occupied`
- `inProgress` (derived: `occupied` + match `in_progress`)
- `paused`
- `unavailable`

Actions:

- Assign match.
- Start match.
- Finish match.
- Pause court.
- Reopen court.

Rules:

- Occupied courts must show players by team.
- Paused or unavailable courts must not receive auto-suggested matches.

### QueuePanel

Purpose:

- Show waiting, resting, done, and removed players in the Available pool.

Part of `PlayerPool`. Spec: `docs/specs/frontend/features/organizer/queue-panel.md`.

State rules: `docs/specs/backend/state-transitions.md`.

Player row data:

- Display name.
- Session rating.
- Queue status.
- Wait time.
- Matches played.
- Payment status.

Actions:

- Open `PlayerDetailDrawer` for session rating, payment, and profile edits.
- Mark resting, back to waiting, mark done, remove, restore (row overflow).
- Skip suggestions / clear skip with optional note.

Rules:

- Payment status should be visible inline on the row.
- Session rating is read-only on the row; edit in `PlayerDetailDrawer`.
- Long-waiting players should be visually easy to identify.
- Players with `assigned` or `playing` status appear on Next-lane and court cards, not in Available tabs.
- Players return to `waiting` automatically after match completion.

### NextQueuePanel

Purpose:

- Show global suggestion preview above queue lane columns; help the organizer stage upcoming doubles matches.

Spec: `docs/specs/frontend/features/organizer/next-queue-panel.md`.

Composes `QueueLaneManagement` for lane operations below the suggestion strip.

State rules: `docs/specs/backend/state-transitions.md`. Assignment pipeline: `docs/specs/backend/queueing-and-ratings.md`. Access: `docs/specs/mvp-access.md`.

Layout:

- Top: **Suggested next match** card (preview only).
- Bottom: lane columns with staged `MatchCard` rows.

Data:

- Top suggestion with explanation and warnings.
- Selected lane id.
- Ordered queue lanes and queued matches grouped by lane.
- Team one and team two per match; `draft` vs `ready` status.
- Open courts for warnings and send-to-court.

Actions:

- Accept suggestion → selected lane.
- Regenerate, swap player, swap teams (preview and staged matches).
- Add empty draft match; manual slot fill.
- Lane CRUD and move-to-court via `QueueLaneManagement`.

Rules:

- Always explain why the suggestion was chosen in plain language.
- Show suggestion even when all courts are busy; warn that staging is still allowed.
- Unpaid warnings are informational only.
- Incomplete `draft` matches may not be sent to court until `ready`.
- Send to court requires court picker when multiple courts are open.
- Deleting a non-empty lane requires confirmation.

### ActiveMatchPanel

Purpose:

- Support match operations from assignment through result recording.

Actions:

- Start match.
- Record score.
- Mark winner without score.
- Cancel match.
- Complete match.

Rules:

- Cancelling a match should not update ratings.
- Completing a scored match should show the rating impact if available.

### PaymentSummaryPanel

Purpose:

- Let organizers quickly track collection status.

Data:

- Expected, collected, unpaid, waived, and **refunded** totals.
- Count by payment status (all five).

Actions:

- Filter unpaid players.
- Open full payments page.
- Quick mark paid from dashboard preview only.

Rules:

- Collected sums `paid` and `partial` only; refunded reduces net collected display.
- Refund and reset actions live on payments page and `PlayerDetailDrawer`.
- Do not mix manual payment tracking with online payment wording.

### PlayerCheckInPanel

Purpose:

- Add walk-ins and returning players during a session.

Part of `PlayerPool` and `organizer-session-players` page. Spec: `features/organizer/player-check-in-panel.md`.

Actions:

- Search existing player.
- Create walk-in (`displayName` required; `phone` optional).
- Check in with optional initial session rating and payment.

Rules:

- Returning players should be check-in-able in a few taps.
- New players default session rating to `3.0`.
- Gender, notes, and full profile edits use `PlayerDetailDrawer` after check-in.

### PlayerDetailDrawer

Purpose:

- Canonical edit surface for session state + club profile.

Spec: `features/organizer/player-detail-drawer.md`.

Opens from queue rows, payments page, players page, leaderboard.

Profile fields (`displayName`, `phone`, `gender`, club rating, `notes`): drawer only on list pages.

Session fields (session rating, payment, queue actions): drawer primary; row overflow for queue shortcuts.

Rules:

- No inline profile forms on `PlayerRow` lists.
- Gender optional; never blocks check-in or queueing.
- Ended sessions: read-only.

### RecentMatchesPanel

Purpose:

- Show recently completed matches for context and correction.

Actions:

- View match detail.
- Correct result if allowed.

Rules:

- When a result is corrected, leaderboard and rating freshness may change; surface sync state if recompute is pending.
- Result correction should be restricted to organizers.
- Correcting a rated-session result must recompute affected players from the corrected match forward.

### LeaderboardView

Purpose:

- Organizer-visible club and session rankings.

Spec: `docs/specs/frontend/features/player/leaderboard-view.md`. Page: `docs/specs/frontend/pages/leaderboard.md`.

Data:

- Scope (`club` | `session`), optional `sessionId`.
- Full `LeaderboardEntryDto` rows with **W-L-D**, win %, games, club rating, attendance.

Rules:

- Always show losses and draws as part of W-L-D.
- Session scope default from dashboard; club scope default from global nav.
- Win % and outcome semantics per `match-results-and-ratings.md`.

## Responsive Behavior

Tablet:

- Use a multi-column dashboard.
- Keep court board and next queue lanes visible above the fold.

Mobile:

- Use tabs or stacked sections.
- Prioritize quick actions: check in, mark paid, add suggestion to Next queue, finish match.

Desktop:

- Immersive session workspace on live routes; payments/history use `SessionWorkspaceShell`.
- Pegboard is the hero on dashboard; link to full payments/history from `SupportingStrip` or overflow menu.
