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
4. **Attention** — Who has not paid? Is sync stuck?

Optimize for **glanceable operational truth** and **one obvious primary action per zone**.

## Layout Regions (Desktop ≥1280px)

Top to bottom on the page:

| Region | Role | Always visible? |
|--------|------|-----------------|
| **Session chrome** | Identity, status chips, secondary nav | Yes |
| **Attention rail** | Exceptions only (unpaid, sync failed, offline) | Conditional |
| **Pegboard** | Available \| Now \| Next — primary operations | Yes (~70vh min) |
| **Supporting strip** | Collected total, recent match teaser, links | After first check-in |

### Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SESSION CHROME (compact)                                                     │
│ ← Sessions │ {Session name} │ venue · time · fee · courts                   │
│ [Active] [Synced] │ Players · Payments · History · Leaderboard · ···        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ATTENTION RAIL (conditional) — e.g. 3 unpaid · Sync failed — Review          │
├─────────────────────────────────────────────────────────────────────────────┤
│ PEGBOARD                                                                     │
│ ┌──────────────┬────────────────────────────────────┬──────────────────┐ │
│ │ AVAILABLE    │ NOW (Courts)                         │ NEXT             │ │
│ │ ~22% width   │ ~48% width                           │ ~30% width       │ │
│ │              │                                      │                  │ │
│ │ Check-in     │ [Court 1] [Court 2] [Court 3]        │ Suggestion       │ │
│ │ (compact)    │  (horizontal strip for 3 courts)     │ Lane tabs        │ │
│ │              │                                      │ Queued matches   │ │
│ │ Waiting list │                                      │ Send to court    │ │
│ │ (scroll)     │                                      │                  │ │
│ └──────────────┴────────────────────────────────────┴──────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ SUPPORTING STRIP — Collected ₱X │ Last match │ Leaderboard │ Complete session│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pegboard column order (desktop)

Left → right: **Available** | **Now** | **Next**

Rationale: Spec pegboard flow is Available → Next → Now mentally, but **courts belong in the visual center** as the largest zone (organizer eyes track active courts first on desktop). Next stays on the right as the staging lane (like a physical pegboard’s “next up” column).

## Zone Definitions

### Available (`PlayerPool`)

| Attribute | Spec |
|-----------|------|
| User question | Who can I pull into the queue? |
| Visual | Light neutral surface; zone header “Available” |
| Components | `PlayerCheckInPanel` (compact) + `QueuePanel` |
| Primary action | Check in walk-in or returning player |
| Scroll | Player list scrolls inside zone; check-in stays pinned at top |

See `player-pool.md`, `player-check-in-panel.md`, `queue-panel.md`.

### Now (`CourtBoard`)

| Attribute | Spec |
|-----------|------|
| User question | Who is on court? What is free? |
| Visual | Court-tinted zone header (`--color-court`); largest player name typography on court cards |
| Components | `CourtCard` per court |
| Primary action | Start match (assigned) / Finish match (in progress) |

**Court grid rules (desktop):**

| Court count | Layout inside Now zone |
|-------------|------------------------|
| 1–3 | Single horizontal row, equal columns |
| 4 | 2×2 grid |
| 5–6 | 2 rows or horizontal scroll **within Now zone** — never orphan a single court in a 2-col grid |

Do **not** use a 2-column grid for 3 courts (creates a visual hole).

See `court-board.md`.

### Next (`NextQueuePanel`)

| Attribute | Spec |
|-----------|------|
| User question | What goes to court next? |
| Visual | Warm accent zone header (`--color-next`) |
| Components | Suggestion strip + `QueueLaneManagement` |
| Primary action | Accept suggestion / Send to court |

See `next-queue-panel.md`, `queue-lane-management.md`.

### Attention (`AttentionRail`)

| Attribute | Spec |
|-----------|------|
| User question | What needs my attention right now? |
| Visual | Full-width warning/info strip; only when triggers fire |
| Components | See `attention-rail.md` |
| Primary action | Jump to Payments / Review sync |

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
| `SessionHeader` | Session chrome | Slimmed per `session-header.md` |
| `SessionStatusBar` | **Deprecated on desktop** | Replaced by `AttentionRail` + inline zone context |
| `SessionStatusBar` | Mobile tab **More** | Keep compact metrics on phone |
| `PlayerPool` | Pegboard left | Check-in compact |
| `CourtBoard` | Pegboard center | Horizontal court strip |
| `NextQueuePanel` | Pegboard right | Unchanged feature logic |
| `PaymentSummaryPanel` | Payments route only on desktop | Teaser in `SupportingStrip` |
| `RecentMatchesPanel` | History route; 1–2 inline in strip | No full card on dashboard |
| `LeaderboardPreview` | Removed from dashboard desktop | Link in strip + `/organizer/leaderboard` |
| `OfflineBanner` | Inside `AttentionRail` when non-synced | Hidden when synced |
| `SyncStatusBadge` | Session chrome chip | No duplicate full banner when healthy |
| `ActiveMatchPanel` | Overlay drawer | Unchanged |
| `PlayerDetailDrawer` | Overlay | Unchanged |
| `SyncReviewPanel` | Overlay | Unchanged |

### Page shell width

- Session dashboard route may use **wider max-width** than global app shell (`max-w-6xl` → `max-w-7xl` or `max-w-[1400px]`) so pegboard columns breathe on desktop.
- Global marketing-style header stays; pegboard is the hero surface.

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

**Court empty slots:** subtle solid fill — not dashed wireframe boxes (dashed reserved for drag targets in future optional DnD).

## Empty States and Progressive Disclosure

See § Empty-State Copy below. Rules:

- Empty session should feel **ready**, not broken.
- Hide `SupportingStrip` until first check-in.
- `AttentionRail` hidden when no exceptions (including when synced and unpaid = 0).

## Migration from Current Implementation

| Current (`SessionDashboardPage`) | Target |
|--------------------------------|--------|
| `SessionStatusBar` with 6 `MetricCard`s | `AttentionRail` on desktop |
| `OfflineBanner` always visible | Banner only when offline / failed / pending |
| `Complete session` prominent red button in header | Text link in `SupportingStrip` or overflow menu |
| `lg:grid-cols-2` for `more` | `SupportingStrip` |
| `CourtBoard` `md:grid-cols-2` for 3 courts | Horizontal 3-col strip in Now zone |
| `max-w-6xl` page constraint | Wider session layout |

## Acceptance Criteria (Layout)

- On desktop ≥1280px, organizer sees Available, Now, and Next **without scrolling** for a 3-court session with empty queue.
- No full-width payment/history/leaderboard cards below pegboard on desktop.
- Three courts render in **one row** inside Now zone (no orphan court).
- When synced and no exceptions, no green “All changes synced” full-width banner — chip only.
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
| `failedCount > 0` or offline | Show Attention rail sync line |

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
- `session-header.md` — Session chrome (updated)
- `session-status-bar.md` — Metrics; desktop deprecation note
- `organizer-session-dashboard.md` — Page route (updated)
- `organizer-components.md` — Composition tree (updated)
