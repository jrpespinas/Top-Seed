# Live Dashboard Layout (Desktop-first)

## Purpose

Define the **page-level layout shell** for the organizer live session dashboard (`/organizer/sessions/:sessionId/dashboard`). This spec corrects implementation drift where the pegboard is buried under generic metric cards and full-width secondary panels.

Read first:

- `docs/specs/frontend/design-system.md` — pegboard mental model, zone colors, mobile tabs
- `docs/specs/frontend/component-architecture.md` — dashboard composition
- `docs/specs/frontend/pages/organizer-session-dashboard.md` — route goals and actions

**Out of scope for this spec:**

- New product features (drag-and-drop, player self-service, login)
- Backend or sync behavior changes
- Pixel-perfect Figma — wireframes below are structural contracts

## North Star

The live dashboard should feel like a **courtside control board**, not a generic SaaS admin template.

Organizer question loop (every 30–90 seconds at open play):

1. **Now** — Which courts are free or finishing?
2. **Next** — Who plays next?
3. **Available** — Who is waiting to be staged?
4. **Attention** — Who has not paid?

Optimize for **glanceable operational truth** and **one obvious primary action per zone**. Sync runs in the background on the dashboard; sync status and review live on the **Admin** page.

## Layout Regions (Desktop ≥1280px)

Top to bottom on the page:

| Region | Role | Always visible? |
|--------|------|-----------------|
| **Session chrome** | Identity, overflow nav (immersive — no global header; no sync badge on dashboard) | Yes |
| **Attention rail** | Unpaid players only on dashboard | Conditional |
| **Pegboard** | Player List \| Upcoming Matches \| Courts — primary operations | Yes (~70vh min) |
| **Supporting strip** | Collected total, recent match teaser, links | After first check-in |

### Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SESSION WORKSPACE BAR (sticky; global app header hidden on this route)       │
│ Top Seed / Sessions · {Session name} │ venue · time · fee · courts            │
│ [Active] │ ··· overflow → Admin · History · Leaderboard · …      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ATTENTION RAIL (conditional) — e.g. 3 unpaid · Sync failed — Review          │
├─────────────────────────────────────────────────────────────────────────────┤
│ PEGBOARD                                                                     │
│ ┌──────────────┬──────────────────────────┬──────────────────────────────┐ │
│ │ PLAYER LIST  │ UPCOMING MATCHES         │ COURTS                       │ │
│ │ ~22% width   │ ~30% width               │ ~48% width                   │ │
│ │              │                          │                              │ │
│ │ Check-in     │ Suggestion + match cards │ [Court 1]                    │ │
│ │ Filter chips │ Lane tabs                │ [Court 2]  (vertical stack)  │ │
│ │ Player cards │ Magic Queue · Add Match  │ [Court 3]                    │ │
│ │ (scroll)     │ (scroll)                 │ (scroll)                     │ │
│ └──────────────┴──────────────────────────┴──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ SUPPORTING STRIP — Collected ₱X │ Last match │ Leaderboard │ Complete session│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pegboard column order (desktop)

Left → right: **Player List** (Available) | **Upcoming Matches** (Next) | **Courts** (Now)

Domain pegboard labels remain Available / Next / Now in code and analytics; **display labels** use Player List, Upcoming Matches, and Courts on desktop.

Rationale: Matches reference-inspired queueing UIs — player pool on the left, staging lane in the center, active courts on the right as the largest zone. Courts stack **vertically** inside the right column (scroll when needed), not as a horizontal strip.

### Zone header pattern (desktop)

Each pegboard column header shows:

- `{Zone title} · {count}` — e.g. `Player List · 4 total`, `Upcoming Matches · 3 queued`, `Courts · 4 active`
- Optional zone action button (`+`) — add walk-in focus, add match, add court

Headers use soft white/surface styling with subtle border; court zone may use a light court accent on the body cards, not a heavy tinted header bar.

### Player List filter chips

Replace status tabs on **desktop** with horizontal filter chips (mobile may keep tabs):

| Chip | Includes queue statuses |
|------|-------------------------|
| **All** | All checked-in players (except `removed` unless viewing removed filter) |
| **Available** | `waiting`, `resting` |
| **Queued** | `assigned` |
| **Playing** | `playing` |

`done` and `removed` remain accessible via overflow or secondary filter on mobile tabs.

## Zone Definitions

### Player List (`PlayerPool`)

| Attribute | Spec |
|-----------|------|
| User question | Who can I pull into the queue? |
| Display label | **Player List** (desktop zone header) |
| Visual | White card stack; zone header `Player List · {n} total` |
| Components | `PlayerCheckInPanel` (compact) + `QueuePanel` with `PlayerCard` rows |
| Primary action | Check in walk-in or returning player |
| Filters | Chip row: All / Available / Queued / Playing (desktop) |
| Scroll | Player list scrolls inside zone; check-in stays pinned at top |

See `player-pool.md`, `player-check-in-panel.md`, `queue-panel.md`.

### Courts (`CourtBoard`)

| Attribute | Spec |
|-----------|------|
| User question | Who is on court? What is free? |
| Display label | **Courts** (desktop zone header) |
| Visual | Zone header `Courts · {n} active`; stacked `CourtCard` rows |
| Components | `CourtCard` per court |
| Primary action | Start match (assigned) / Finish match (in progress) |

**Court layout rules (desktop):**

| Court count | Layout inside Courts zone |
|-------------|---------------------------|
| 1–6 | **Vertical stack** of court cards; column scrolls when height exceeds pegboard |

Do **not** use a horizontal strip or 2-column grid that orphans a single court on desktop pegboard.

See `court-board.md`.

### Upcoming Matches (`NextQueuePanel`)

| Attribute | Spec |
|-----------|------|
| User question | What goes to court next? |
| Display label | **Upcoming Matches** (desktop zone header) |
| Visual | Zone header `Upcoming Matches · {n} queued`; stacked match cards |
| Components | Suggestion strip + `QueueLaneManagement` |
| Primary action | Magic Queue (accept suggestion) / Add Match |
| Footer | `Magic Queue` + `Add Match` buttons when lane selected |

See `next-queue-panel.md`, `queue-lane-management.md`.

### Attention (`AttentionRail`)

| Attribute | Spec |
|-----------|------|
| User question | What needs my attention right now? |
| Visual | Full-width warning/info strip; only when triggers fire |
| Components | See `attention-rail.md` |
| Primary action | Jump to Admin (payments) |

Sync failures and offline state are **not** shown on the live dashboard. See Admin page and `session-workspace-shell.md`.

**Replaces on desktop:** the six-tile `SessionStatusBar` metric strip (see migration note below).

### Supporting (`SupportingStrip`)

| Attribute | Spec |
|-----------|------|
| User question | Quick receipts without leaving the pegboard |
| Visual | Muted single row; low height; collapsible on demand |
| Content | Collected total · last 1–2 recent matches (inline) · leaderboard link · Complete session (text link) |
| Visibility | Hidden until `checkedIn >= 1` |

**Replaces on desktop:** full-width `PaymentSummaryPanel`, `RecentMatchesPanel`, and `LeaderboardPreview` cards below the pegboard.

## Component Mapping

### New layout components (to implement)

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| `PegboardLayout` | `features/dashboard/` or `components/layout/` | Three-column pegboard grid; zone wrappers with headers and tokens |
| `AttentionRail` | `features/dashboard/` | Conditional exception strip; see `attention-rail.md` |
| `SupportingStrip` | `features/dashboard/` | Compact secondary row; links to full pages |

### Existing components — placement

| Component | Desktop placement | Notes |
|-----------|-------------------|-------|
| `SessionWorkspaceBar` | Session chrome | Immersive sticky bar; see `session-header.md` |
| `SessionWorkspaceShell` | Payments / history pages | Shared chrome + `useSessionChrome`; see `session-workspace-shell.md` |
| `SessionStatusBar` | **Deprecated on desktop** | Replaced by `AttentionRail` + inline zone context |
| `SessionStatusBar` | Mobile tab **More** | Keep compact metrics on phone |
| `PlayerPool` | Pegboard left (Player List) | Check-in compact; filter chips; `PlayerCard` |
| `NextQueuePanel` | Pegboard center (Upcoming Matches) | Stacked match cards |
| `CourtBoard` | Pegboard right (Courts) | Vertical court stack |
| `PaymentSummaryPanel` | Payments route only on desktop | Teaser in `SupportingStrip` |
| `RecentMatchesPanel` | History route; 1–2 inline in strip | No full card on dashboard |
| `LeaderboardPreview` | Removed from dashboard desktop | Link in strip + `/organizer/leaderboard` |
| `OfflineBanner` | Admin page (`SessionSyncBar`) | Hidden on live dashboard |
| `SyncStatusBadge` | Session chrome chip | No duplicate full banner when healthy |
| `ActiveMatchPanel` | Overlay drawer | Unchanged |
| `PlayerDetailDrawer` | Overlay | Unchanged |
| `SyncReviewPanel` | Overlay | Unchanged |

### Page shell width and global header

- Session workspace routes (`dashboard`, `payments`, `history`, `players`) use **wider max-width** (`max-w-[1400px]`) so pegboard columns breathe on desktop.
- On those routes, the **global app header is hidden**; `SessionWorkspaceBar` provides Top Seed branding and cross-route navigation via overflow.
- Non-session routes (`/organizer/sessions`, `/organizer/leaderboard`, etc.) keep the standard global header and `max-w-6xl` shell.

### Deprecated desktop pattern (do not ship)

```text
❌ lg:grid 3-col pegboard
❌ THEN separate lg:grid-cols-2 full-width PaymentSummary + RecentMatches + Leaderboard
```

This pattern forces scroll, hides courts, and reads as “admin dashboard + reports below.”

## Responsive Behavior

### Desktop (≥1280px) — **primary spec**

- Full pegboard visible without scrolling for core ops (target ~70vh min-height on pegboard region).
- `AttentionRail` + `SupportingStrip` as defined above.
- No bottom tabs.

### Tablet (768px–1279px)

- Keep **Now + Next** side-by-side when possible.
- **Available** below pegboard or in collapsible left drawer.
- `AttentionRail` may show 2–3 compact metrics inline.
- Do **not** copy desktop’s deprecated full-width `more` card stack.

### Mobile (&lt;768px)

- Bottom tabs: **Now** (default) | **Next** | **Available** | **More** per `design-system.md`.
- `SessionStatusBar` compact horizontal scroll remains acceptable on **More** tab.
- Sticky primary action per tab (Finish match on Now, Send to court on Next).

## Visual Tokens (zone surfaces)

Apply per `design-system.md` § Aesthetic Direction:

| Zone | Header background | Body |
|------|-------------------|------|
| Available | `surface` + neutral border | white / `surface` |
| Now | `--color-court` foreground on court-tinted header | white cards with court accent border |
| Next | `--color-next` foreground on warm-tinted header | white body |
| Attention | `--color-attention-surface` when warning | — |
| Supporting | `muted` background, no card chrome | — |

**Court empty slots:** subtle solid fill when idle; ring or dashed highlight on valid drop targets during desktop drag. See `desktop-drag-and-drop.md`.

## Empty States and Progressive Disclosure

See § Empty-State Copy below. Rules:

- Empty session should feel **ready**, not broken.
- Hide `SupportingStrip` until first check-in.
- When no unpaid players, `AttentionRail` hidden on dashboard.
- No sync badge or sync banner on the live dashboard.

## Migration from Current Implementation

| Current (`SessionDashboardPage`) | Target |
|--------------------------------|--------|
| `SessionStatusBar` with 6 `MetricCard`s | `AttentionRail` on desktop |
| `OfflineBanner` always visible | Hidden on dashboard; Admin page + background auto-sync |
| `Complete session` prominent red button in header | Text link in `SupportingStrip` or overflow menu |
| `lg:grid-cols-2` for `more` | `SupportingStrip` |
| `CourtBoard` `md:grid-cols-2` for 3 courts | Vertical stack in Courts zone |
| `max-w-6xl` page constraint | Wider session layout |

## Acceptance Criteria (Layout)

- On desktop ≥1280px, organizer sees Player List, Upcoming Matches, and Courts **without scrolling** for a 3-court session with empty queue (courts column may scroll when more than ~3 courts).
- No full-width payment/history/leaderboard cards below pegboard on desktop.
- Three courts render in a **vertical stack** inside Courts zone.
- No sync chip or banner on the live dashboard.
- Complete session requires confirmation; trigger is not the most prominent red control on the page.
- Mobile tabs unchanged in IA; only visual polish in later passes.

## Empty-State Copy

Canonical strings for live dashboard zones when session has zero or partial data.

### Progressive disclosure

| Condition | UI behavior |
|-----------|-------------|
| `checkedIn === 0` | Hide `SupportingStrip`; emphasize check-in in Available |
| `checkedIn >= 1` | Show `SupportingStrip` |
| `unpaid === 0` and sync OK | Hide payment line in `AttentionRail` |
| `unpaid > 0` | Show Attention rail payment line |
| Sync issues | Background retry; review on Admin page only |

### Available zone

| State | Title | Body | Primary CTA |
|-------|-------|------|-------------|
| No players checked in | Check in your first players | Search returning players or add a walk-in to start the queue. | Focus check-in field |
| No waiting players (but checked in) | No one waiting | Players may be on court, in Next, or marked resting. | — |
| Search no results | No matches | Try a different name or add a walk-in. | — |

### Next zone

| State | Title | Body | Primary CTA |
|-------|-------|------|-------------|
| &lt;4 waiting, suggested mode | Need four waiting players | Check in more players or clear skips to get a suggested doubles match. | — (Accept disabled) |
| Suggestion available | Suggested match | {explanation from engine} | Add to [lane name] |
| Lane empty | Next is empty | Add a match or accept a suggestion. | Add match |
| Manual queue mode | Build the next match | Add players to a match in this lane, then send to court. | Add match |

### Now zone (courts)

| State | Slot empty label | Court open label |
|-------|------------------|------------------|
| Open court, no assignment | Assign from Next | Open |
| Partial assignment | Open slot | Partially filled |
| In progress | — | In progress (Finish match primary) |

Use **“Assign from Next”** instead of “Team A player 1 empty” on open courts.

### Supporting strip

| State | Copy |
|-------|------|
| No payments yet | Collected ₱0 of ₱{expected} · View payments |
| No matches yet | No finished matches yet · View history |
| Leaderboard empty | Leaderboard · View all |

### Attention rail

| Trigger | Copy |
|---------|------|
| Unpaid &gt; 0 | {n} unpaid · View payments |
| Sync failed | Sync failed for {n} change(s) · Review |
| Offline + pending | Offline — {n} changes saved on this device |
| All clear | *(region not rendered)* |

## Desktop Usability Validation Checklist

Run with **1–2 real organizers** on desktop (≥1280px) **before implementation sign-off**. Observer notes pass/fail and time.

| # | Task | Success signal | Pass? | Notes |
|---|------|----------------|-------|-------|
| 1 | Check in a walk-in | ≤2 clicks; check-in visible without scrolling pegboard | | |
| 2 | Accept suggestion and send to Court 1 | Primary action obvious on Next zone; no paragraph reading required | | |
| 3 | Start and finish a match on Court 2 | Court visible without scroll; Finish is primary on in-progress card | | |
| 4 | Find who has not paid | Attention rail or one link — not a full card below fold | | |
| 5 | Complete session | Found intentionally (not mis-tap); confirm dialog shown | | |

**Qualitative prompt after tasks:** “Does this feel like running courts, or filling out a form?”

Target: **5/5 pass** on success signals; qualitative answer favors “running courts.”

## Related Specs

- `attention-rail.md` — Attention region detail
- `session-header.md` — `SessionWorkspaceBar` (immersive session chrome)
- `session-workspace-shell.md` — shared shell for payments / history
- `desktop-drag-and-drop.md` — optional desktop DnD
- `session-status-bar.md` — Metrics; desktop deprecation note
- `organizer-session-dashboard.md` — Page route (updated)
- `organizer-components.md` — Composition tree (updated)
