# Phase 10 — Live dashboard layout & courtside UX (desktop-first)

Implement **Phase 10 only**: reshape the organizer live session dashboard from a generic admin layout into a **courtside control board** — pegboard shell, attention rail, supporting strip, zone styling, header diet, and guided empty states. **Desktop (≥1280px) is the primary target**; tablet and mobile get a light polish pass without redesigning tab IA.

Do **not** implement new product features (drag-and-drop, player routes, login, payment gateway, PWA), backend changes, or sync engine changes.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0–5** | Monorepo, domain, API, Dexie, UI primitives, session list/create |
| **6** | Live dashboard pegboard — `PlayerPool`, `CourtBoard`, `NextQueuePanel`, match lifecycle |
| **7** | Payments, history, leaderboard, players pages; `PaymentSummaryPanel`, `RecentMatchesPanel` |
| **8** | `SyncReviewPanel`, failed/blocked sync recovery |
| **9** | Remaining sync action parity (`CREATE_PLAYER_PROFILE`, `UPDATE_*` replay) |

Phases 6–9 made the dashboard **functionally correct**. Phase 10 fixes **layout and visual hierarchy drift**: the pegboard is buried under six metric tiles and full-width payment/history/leaderboard cards below the fold.

**North star:** Glanceable operational truth — Available | Now | Next on one screen; exceptions only in an attention rail; receipts in a thin supporting strip.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/frontend/features/organizer/live-dashboard-layout.md` — **primary contract** (wireframes, zones, empty states, validation checklist)
3. `docs/specs/frontend/features/organizer/attention-rail.md`
4. `docs/specs/frontend/features/organizer/session-header.md` — updated chrome rules
5. `docs/specs/frontend/features/organizer/session-status-bar.md` — deprecated on desktop
6. `docs/specs/frontend/component-architecture.md` — dashboard composition model
7. `docs/specs/frontend/pages/organizer-session-dashboard.md`
8. `docs/specs/frontend/design-system.md` — zone colors, pegboard mental model, mobile tabs
9. `docs/specs/frontend/organizer-components.md` — updated composition tree

Skim only (behavior unchanged; layout/copy may shift):

| Surface | Spec |
|---------|------|
| `PlayerPool` | `features/organizer/player-pool.md` |
| `CourtBoard` | `features/organizer/court-board.md` |
| `NextQueuePanel` | `features/organizer/next-queue-panel.md` |
| `CourtCard` | `components/domain/court-card.md` |

Do **not** implement player-facing routes or login specs.

## Current drift (fix these)

| Problem | Where today | Target |
|---------|-------------|--------|
| Pegboard + full-width `more` cards | `SessionDashboardPage.tsx` — `lg:grid-cols-2` block after pegboard | `SupportingStrip` only; no full cards on desktop |
| Six equal metric tiles on desktop | `SessionStatusBar` always rendered | `AttentionRail` on desktop; `SessionStatusBar` on mobile **More** tab only |
| Court 3 orphan in 2-col grid | `CourtBoard` — `md:grid-cols-2` | Horizontal strip for 3 courts inside Now zone |
| Boxed-in layout | `router.tsx` — `max-w-6xl` on all routes | Wider max-width for session dashboard route |
| Duplicate sync UI | `SessionHeader` — `SyncStatusBadge` + always-on `OfflineBanner` | Badge when synced; banner content in `AttentionRail` only when needed |
| Prominent Complete session | `SessionHeader` — red `ConfirmAction` | Text link in `SupportingStrip` or overflow |
| Dashed empty court slots | `court-card.tsx` — `border-dashed` | Subtle solid fill; copy “Assign from Next” |
| Flat white zones | No zone-tinted headers | `--color-court`, `--color-next` on pegboard zone headers |
| Generic empty session | Multiple “empty” messages at once | Progressive disclosure per `live-dashboard-layout.md` § Empty-State Copy |

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` only — **no API or Dexie schema changes** |
| Styling | Existing Tailwind tokens (`court`, `next`, `surface`, `muted`); extend `index.css` app background if needed |
| Layout primitives | New `PegboardLayout`, `AttentionRail`, `SupportingStrip` under `features/dashboard/` |
| Data | Reuse `useSessionDashboard` — no new hooks unless extracting visibility helpers |
| Routing | Optional route-level layout wrapper for wider session pages (dashboard + sub-routes) |
| Behavior | All existing callbacks (`onCheckIn`, `onAcceptSuggestion`, sync review, etc.) unchanged |
| Testing | Vitest + `@testing-library/react`; layout visibility and conditional render tests |

**Do not use:** new state management libraries, drag-and-drop libraries, or redesign of queue/court business logic.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/dashboard/
    SessionDashboardPage.tsx     # recompose: chrome → rail → pegboard → strip
    SessionHeader.tsx            # slim chrome; remove always-on OfflineBanner
    AttentionRail.tsx            # NEW — conditional exceptions
    PegboardLayout.tsx           # NEW — three-zone grid + zone headers
    SupportingStrip.tsx          # NEW — collected, recent teaser, links, complete
    SessionStatusBar.tsx         # keep; desktop hide via page composition
    PlayerPool.tsx               # compact check-in variant prop (optional)
    PaymentSummaryPanel.tsx      # unchanged; used on Payments route + strip data
    RecentMatchesPanel.tsx       # unchanged; used on History route + strip teaser
    LeaderboardPreview.tsx       # remove from desktop dashboard composition
  features/courts/
    CourtBoard.tsx               # court-count-aware grid; zone header optional (or in PegboardLayout)
  components/domain/
    court-card.tsx               # empty slot styling + copy
  routes/
    router.tsx                   # wider layout for `/organizer/sessions/$sessionId/*`
  index.css                      # optional warm off-white page background
```

## Implementation phases (do in order)

### 1. Layout shell

- Add `PegboardLayout` with desktop columns **~22% / ~48% / ~30%**, `min-h-[70vh]` on pegboard region.
- Refactor `SessionDashboardPage`:
  - Desktop: `SessionHeader` → `AttentionRail` → `PegboardLayout` (pool | courts | next) → `SupportingStrip`.
  - **Remove** desktop `lg:grid-cols-2` `more` block.
  - Keep mobile bottom tabs (**Now** | **Next** | **Available** | **More**); move `SessionStatusBar` into **More** tab content only.
- Widen session layout: e.g. `max-w-7xl` or `max-w-[1400px]` for `/organizer/sessions/$sessionId/*` routes without widening global marketing shell if undesirable.

### 2. Attention rail + header diet

- Implement `AttentionRail` per `attention-rail.md`:
  - Show when `unpaid > 0`, `failedCount > 0`, `blockedCount > 0`, or offline with pending.
  - **Hidden** when synced, online, and `unpaid === 0`.
  - Compose `OfflineBanner` **inside rail** when appropriate — not in header when healthy.
- Update `SessionHeader`:
  - Keep row 1: back link, title, meta, status chip, `SyncStatusBadge`.
  - Secondary nav: keep links or move overflow (`···`) if cramped — do not add a fourth nav band.
  - Remove always-visible `OfflineBanner`.
  - Move **Complete session** out of prominent header position (to `SupportingStrip`).
- Hide `ApiStatusBanner` on live dashboard when API healthy (keep on sessions list / dev if useful).

### 3. Supporting strip

- Implement `SupportingStrip`:
  - One muted horizontal row: `Collected ₱X of ₱Y` · last 1–2 recent matches (inline names/scores) · Leaderboard link · Complete session (text + `ConfirmAction`).
  - **Hidden** when `checkedIn === 0` (progressive disclosure).
  - Links navigate to existing Payments / History / Leaderboard routes.
- Do not render full `PaymentSummaryPanel`, `RecentMatchesPanel`, or `LeaderboardPreview` on desktop dashboard.

### 4. Zone styling + court grid

- `PegboardLayout` zone headers:
  - **Available** — neutral surface
  - **Now** — `bg-court` / `text-court-foreground` header
  - **Next** — `bg-next` / `text-next-foreground` header
- Light elevation on pegboard zone panels only (subtle shadow or border).
- `CourtBoard` grid by court count (desktop inside Now zone):

| Courts | Grid |
|--------|------|
| 1–3 | `grid-cols-3` single row |
| 4 | `grid-cols-2` × 2 |
| 5–6 | 2 rows or `overflow-x-auto` **within Now zone** |

- Remove duplicate “Courts” H2 if zone header covers it.

### 5. Empty states + copy

Apply canonical copy from `live-dashboard-layout.md` § Empty-State Copy:

| Zone | Key change |
|------|------------|
| Available (0 check-ins) | “Check in your first players” — emphasize check-in, not “No waiting players” |
| Next (&lt;4 waiting, suggested) | “Need four waiting players” + disabled Accept |
| Courts (open) | “Open” + “Assign from Next” on empty slots |
| Supporting | Hidden until first check-in |

Update `court-card.tsx` empty slots: solid subtle fill, not dashed wireframe.

### 6. Tablet / mobile polish (light)

- Tablet (`md`–`lg`): avoid reintroducing full-width payment/history cards below pegboard.
- Mobile: ensure **More** tab still exposes payments/history via existing panels or compact links.
- No bottom-tab IA change required.

## Component contracts

### `AttentionRail`

```tsx
interface AttentionRailProps {
  unpaidCount: number;
  connectionStatus: "online" | "offline";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  failedCount: number;
  blockedCount: number;
  lastSyncedAt?: string;
  onViewPayments: () => void;
  onReviewSyncIssues?: () => void;
  onRetrySync: () => void;
}
```

Render `null` when nothing to show (synced + online + unpaid === 0).

### `PegboardLayout`

```tsx
interface PegboardLayoutProps {
  available: React.ReactNode;
  now: React.ReactNode;
  next: React.ReactNode;
  className?: string;
}
```

Applies zone headers, column widths, and `min-h-[70vh]` on desktop (`lg:`).

### `SupportingStrip`

```tsx
interface SupportingStripProps {
  session: LocalSession;
  paymentSummary: PaymentSummary; // or existing dashboard shape
  recentMatches: LocalMatch[];
  checkIns: LocalCheckIn[];
  courts: LocalCourt[];
  sessionId: string;
  sessionMode: SessionMode;
  checkedInCount: number;
  onCompleteSession: () => Promise<void>;
}
```

Return `null` when `checkedInCount === 0`.

## Tests (required)

| Area | Examples |
|------|----------|
| `AttentionRail` | Hidden when synced + no unpaid; shows unpaid link; shows sync failure + Review |
| `SupportingStrip` | Hidden at 0 check-ins; shows collected total after check-in |
| `PegboardLayout` | Renders three zones with correct aria/headings |
| `SessionDashboardPage` | Desktop: no `SessionStatusBar`, no full-width payment card grid |
| `SessionHeader` | No `OfflineBanner` when `syncStatus === "synced"` and online |
| `CourtBoard` | 3 courts → 3-column grid at `lg` |
| `court-card` | Empty slot not `border-dashed` |

Keep Phases 6–9 tests passing. Target **~10–20** new meaningful tests.

Use router wrapper when testing `SessionDashboardPage`.

## Manual validation (required before merge)

Run the **5-task desktop checklist** from `live-dashboard-layout.md` § Desktop Usability Validation Checklist on a **≥1280px** viewport with a 3-court session:

1. Check in walk-in — ≤2 clicks, no pegboard scroll
2. Accept suggestion → send to court — obvious Next action
3. Finish match on Court 2 — court visible, Finish primary
4. Find unpaid — attention rail or one link, not below-fold card
5. Complete session — intentional placement, confirm dialog

Qualitative: “Feels like running courts, not filling out a form.”

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with new Phase 10 tests
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] Desktop dashboard: pegboard visible without scroll for 3-court empty session
- [ ] No `lg:grid-cols-2` full-width payment/history/leaderboard block on desktop
- [ ] `SessionStatusBar` not rendered on desktop live dashboard
- [ ] `AttentionRail` hidden when synced + no unpaid
- [ ] `OfflineBanner` not duplicated in header when healthy
- [ ] Complete session demoted from prominent red header button
- [ ] 3 courts in one horizontal row (no orphan grid hole)
- [ ] Zone headers use court/next tokens
- [ ] Supporting strip hidden until first check-in
- [ ] Empty-state copy matches layout spec tables
- [ ] Mobile tabs unchanged; **More** still reaches payments/history
- [ ] Manual 5-task checklist completed (note pass/fail in PR)

## Explicitly out of scope

- Player self-service routes, login, share session / QR
- Payment gateway, new payment features
- Drag-and-drop queue/court assignment
- Backend / sync action changes
- PWA service worker
- Full tablet redesign or new mobile tab names
- Figma / design tool deliverables
- Running formal user research (implementer runs checklist only)

## Constraints for the implementer

- **Behavior-preserving refactor** — same `useSessionDashboard` actions and sync flows; layout and presentation only.
- Match canonical component names in `organizer-components.md`; register new components in that file if you add `AttentionRail`, `PegboardLayout`, `SupportingStrip`.
- If implementation diverges from spec, update the relevant spec in the same PR with a one-line reason.
- Prefer boring Tailwind over new CSS modules.
- Do not widen every app route — only session organizer routes that benefit from pegboard width.
- Warm background shift is subtle; do not break contrast tokens from `design-system.md`.

## Phase 11+ handoff notes

After Phase 10, natural next increments:

| Theme | Examples |
|-------|----------|
| **Tablet layout** | Available drawer, sticky zone actions |
| **Mobile polish** | Sticky Finish / Send to court per tab |
| **Realtime** | Cross-device dashboard refresh |
| **Player-facing** | Self check-in, player status routes |
| **PWA** | Install prompt, offline shell |
| **Desktop DnD** | Phase 11 — `desktop-drag-and-drop.md`, `prompt_history/phase-11.md` |
