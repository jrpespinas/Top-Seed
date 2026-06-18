# Phase 7 — Payments, history, leaderboard, and player management

Implement **Phase 7 only**: replace Phase 6 stub pages with full organizer session pages for **payments**, **match history** (with correction), **leaderboard**, and **dedicated player management**; complete **`PlayerDetailDrawer`** as the shared edit surface; add optional **dashboard leaderboard preview**. Do **not** implement `SyncReviewPanel`, export backup, player self-service routes, or payment gateway UI.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, contracts, web shell |
| **1** | `packages/domain` pure rules (payments, stats, ratings, `recomputeSessionFromMatches`) |
| **2** | API use cases + partial sync replay |
| **3** | Dexie, outbox, `applyMutation`, sync engine |
| **4** | UI primitives + domain components (`PlayerRow`, `PaymentBadge`, `MatchCard`, …) |
| **5** | Session list/create, `sessionMode` |
| **6** | Live dashboard pegboard, compact `PaymentSummaryPanel` / `RecentMatchesPanel`, payment/history **stub routes**, thin `recordPaymentLocal` |

This phase completes the **organizer back-office surfaces** linked from the dashboard: who paid, what finished, who’s winning, and full player/profile edits — all **local-first** and **session-mode** aware.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/mvp-access.md` — **authoritative** for `live` vs `ended`; no login/roles
3. `docs/specs/backend/payments.md` — manual payment rules, five statuses
4. `docs/specs/backend/match-results-and-ratings.md` — outcomes, correction, leaderboard semantics
5. `docs/specs/backend/sync-actions.md` — `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE`
6. `docs/specs/backend/sync-payload-reference.md` — golden JSON for payment and correction payloads
7. `docs/specs/backend/api-contracts.md` — `PaymentSummaryDto`, `LeaderboardEntryDto`, dashboard snapshot
8. `docs/specs/frontend/frontend-technical-standards.md` — local-first mutation rules

**Read each page/feature spec before implementing that surface:**

| Surface | Spec |
|---------|------|
| Payments page | `pages/organizer-session-payments.md` |
| History page | `pages/organizer-session-history.md` |
| Leaderboard page | `pages/leaderboard.md` |
| Leaderboard UI | `features/player/leaderboard-view.md` |
| Players page | `pages/organizer-session-players.md` |
| `PlayerDetailDrawer` | `features/organizer/player-detail-drawer.md` |
| `PaymentSummaryPanel` (full mode) | `features/organizer/payment-summary-panel.md` |
| `RecentMatchesPanel` (correction UX) | `features/organizer/recent-matches-panel.md` |

Skim only (Phase 8): `features/organizer/sync-review-panel.md`

Do **not** implement player-facing routes (`player-check-in.md`, `player-session-status.md`, etc.).

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` primary; extend `packages/contracts` + `apps/api` only where endpoints/schemas are missing |
| Session store | **Dexie** — same tables as Phase 6; no second store |
| Mutations | Reuse `applyMutation` + outbox; upgrade `recordPaymentLocal` → dedicated `updatePaymentLocal` |
| Domain logic | **`@top-seed/domain`** — `computePaymentSummary`, `validatePaymentTransition`, `recomputeSessionFromMatches`, `computeWinRate`, `buildLeaderboardEntries` (add if missing) |
| Leaderboard (offline) | Compute from local `matches` + `checkIns` + `playerProfiles` for session scope; club scope from all local sessions or API when online |
| Server coord | `POST /api/v1/sync/actions` for replay; direct REST where Phase 2 exposes endpoints |
| UI | Phase 4 components + Phase 6 feature panels; new pages under `features/` |
| Testing | Vitest + `fake-indexeddb` for mutations/stats; `@testing-library/react` for pages |

**Do not use:** Redux, role gates, login, payment gateways, player self-service, `requirePaymentBeforePlay` gating.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/
    payments/
      SessionPaymentsPage.tsx       # replaces SessionPaymentsStubPage
      PaymentList.tsx
      PaymentEditDrawer.tsx         # optional; or inline row actions
    history/
      SessionHistoryPage.tsx        # replaces SessionHistoryStubPage
      MatchHistoryList.tsx
      MatchCorrectionDrawer.tsx
    leaderboard/
      LeaderboardPage.tsx
      LeaderboardView.tsx           # per leaderboard-view.md
      leaderboard-helpers.ts        # local compute + sort
    players/
      SessionPlayersPage.tsx
      PlayerDetailDrawer.tsx        # shared overlay — wire everywhere
    dashboard/
      PaymentSummaryPanel.tsx       # upgrade: full totals mode + preview link
      RecentMatchesPanel.tsx        # upgrade: correction entry → history
      LeaderboardPreview.tsx        # optional: top 5 session rows
  mutations/
    updatePayment.ts                # UPDATE_PAYMENT outbox (replace thin recordPayment)
    correctMatchResult.ts           # UPDATE_MATCH_RESULT + local recompute
    updatePlayerProfile.ts          # UPDATE_PLAYER_PROFILE
  hooks/
    useSessionPayments.ts
    useSessionHistory.ts
    useLeaderboard.ts               # scope + sort + offline compute
    usePlayerDetail.ts
  lib/
    leaderboard-snapshot.ts         # Dexie → LeaderboardEntryDto[]
    session-stats.ts                # per-player W-L-D for drawer
  routes/
    router.tsx                      # wire real pages + /organizer/leaderboard
```

Keep Phase 6 dashboard pegboard **unchanged** except compact panel upgrades and new nav links.

## Recommended build order (vertical slices)

1. **`PlayerDetailDrawer`** — shared edit surface (session + profile); unblocks payments, players, leaderboard taps.
2. **Payments** — `updatePaymentLocal` + full `SessionPaymentsPage`; upgrade dashboard `PaymentSummaryPanel`.
3. **History** — `SessionHistoryPage` + match detail; read-only first, then correction drawer.
4. **Correction + recompute** — `correctMatchResultLocal` + `recomputeSessionFromMatches`; freshness callouts on history/leaderboard.
5. **Leaderboard** — local session leaderboard + `LeaderboardPage` with club/session tabs.
6. **Players page** — compose `PlayerCheckInPanel` + `QueuePanel` + drawer (dedicated route).
7. **Dashboard polish** — `RecentMatchesPanel` correction link, optional `LeaderboardPreview`, players nav link.

## Build — `PlayerDetailDrawer` (shared)

Per `player-detail-drawer.md`. **Required in Phase 7** — Phase 6 deferred most of this.

### Section 1 — This session (read + edit)

Read-only `DataList`:

- Queue status, wait time, matches played, session **W-L-D** and win % (from `session-stats.ts` + domain)

Editable:

- Session skill rating → `updateCheckInLocal`
- Payment actions (same as payments page) → `updatePaymentLocal`
- Queue quick actions, skip suggestions → `updateCheckInLocal`
- Remove from session → `updateCheckInLocal` (`removed`) with `ConfirmAction`; blocked while `playing`

### Section 2 — Player profile

Editable: `displayName`, `phone`, `gender` (optional select), `defaultSkillRating`, `notes` → `updatePlayerProfileLocal` + `UPDATE_PLAYER_PROFILE` outbox.

### Wiring

Open drawer from:

- `QueuePanel` / `SessionPlayersPage` rows
- Payment list rows
- `LeaderboardView` row tap
- Optional: dashboard player rows

Pass `sessionMode` — ended sessions: read-only, hide save/mutation buttons.

## Build — session payments page

Route: `/organizer/sessions/:sessionId/payments` — **replace** `SessionPaymentsStubPage`.

Per `organizer-session-payments.md`:

### Layout

- `PaymentSummaryPanel` in **full totals** mode (`expected`, `collected`, `unpaid`, `waived`, `refunded`, `countsByStatus`)
- Status filter: All | Unpaid | Partial | Paid | Waived | Refunded (`Tabs` or chips)
- Sort: unpaid first, then name (client-side)
- List: `PlayerRow` (`payment` variant) + row actions

### Payment actions (live session only)

| From status | Actions |
|-------------|---------|
| `unpaid`, `partial` | Mark paid, Mark partial, Waive, edit amount/method/notes |
| `paid`, `partial` | Mark refunded (confirm), Reset to unpaid (confirm) |
| `waived`, `refunded` | Reset to unpaid (confirm) |

Use `validatePaymentTransition` from `@top-seed/domain` before local writes.

Copy per spec: **Mark paid**, **Mark refunded**, **Reset to unpaid** — not gateway language.

### Deep link

Support `?status=unpaid` query → pre-select filter (TanStack Router search params).

### Session mode

- **live**: all actions enabled
- **ended**: read-only list + totals; hide mutation buttons

## Build — `updatePaymentLocal`

Replace thin `recordPaymentLocal` wrapper with proper mutation:

1. Validate with domain payment rules + Zod payload aligned with `UPDATE_PAYMENT` in `sync-actions.md`.
2. Dexie transaction: update `checkIns` row + enqueue `UPDATE_PAYMENT` outbox (`entityType: checkIn`).
3. Set `syncStatus: pending` on check-in.
4. Trigger sync when online.

Payload fields: `paymentStatus`, `paymentAmountDue`, `paymentAmountPaid`, `paymentMethod`, `paymentNotes`, `updatedAt`.

**Mark refunded** must reduce collected total per `payments.md` (adjust `paymentAmountPaid` / status semantics consistently with `computePaymentSummary`).

## Build — session history page

Route: `/organizer/sessions/:sessionId/history` — **replace** `SessionHistoryStubPage`.

Per `organizer-session-history.md`:

- List completed, draw, unscored, and cancelled matches from Dexie `matches` (newest first or by `completedAt`)
- `MatchCard` variants: `completed`, `history`; cancelled visually distinct
- Filter tabs: All | Wins/Losses | Draws | Unscored | Cancelled
- Match detail drawer: court, teams, scores, outcome, rating deltas if rated, sync badge
- **Correct result** action when `sessionMode === 'live'` and match `status === 'completed'`

Ended sessions: view-only; hide correction unless spec explicitly allows (default: hide).

## Build — match result correction

Implement `correctMatchResultLocal`:

1. Validate with `validateCorrectMatchResult` (domain) + session mode.
2. Update local `matches` row (outcome, scores, `winningTeam`).
3. Run `recomputeSessionFromMatches` for session-scoped stats/ratings from corrected match forward.
4. Update affected `checkIns.sessionSkillRating`, `playerProfiles.defaultSkillRating`, match participant `ratingAfter` / `ratingDelta` locally.
5. Enqueue `UPDATE_MATCH_RESULT` outbox per `sync-actions.md`.
6. Return side-effect hints for UI (`leaderboardRecomputed`, `ratingApplied`).

### Correction UX (freshness)

Per `recent-matches-panel.md` and `match-results-and-ratings.md`:

- After local correction: inline callout **Result updated — stats refreshing** on history row
- `LeaderboardView`: banner **Stats may be updating** while recompute/sync pending
- Rated sessions: explain ratings recomputed from corrected match forward within session
- Casual sessions: stats/history change without rating change

MVP limitation (document in PR if deferred): cross-session club rating recompute may lag; show copy **Ratings updated for tonight's session**.

## Build — leaderboard page

Routes:

- `/organizer/leaderboard` — club scope default
- `/organizer/leaderboard?sessionId=:sessionId` — session scope default (from dashboard)

Per `leaderboard.md` + `leaderboard-view.md`.

### `LeaderboardView` component

- Scope control: **Club** | **This session** (session tab when `sessionId` known)
- Sort `Select`: rating, wins, losses, draws, games, win %, sessions
- Rows: rank, player, **W-L-D**, win %, games, club rating, sessions (hide sessions column in session scope if redundant)
- Tap row → `PlayerDetailDrawer`
- `EmptyState` when no check-ins or no completed matches in scope
- Offline: compute from Dexie; show `OfflineBanner` / freshness note

### Local leaderboard compute

Implement `lib/leaderboard-snapshot.ts`:

**Session scope:** completed matches in `sessionId` + check-ins for attendance → `PlayerStats` per player via domain → `LeaderboardEntryDto` rows with `computeWinRate`.

**Club scope:** aggregate across all local sessions’ completed matches + all check-ins (MVP: all data in Dexie for default org). Sort and rank client-side.

Do **not** re-derive win/loss/draw rules in UI — use domain `applyOutcomeToPlayerStats` / `recomputeSessionFromMatches`.

### API integration (optional, do not block)

When online:

- `GET /api/v1/sessions/:sessionId/leaderboard`
- `GET /api/v1/leaderboards/current`

Merge into local view when available; **do not clobber** unsynced local match corrections. Prefer local when pending correction outbox exists.

## Build — session players page

Route: `/organizer/sessions/:sessionId/players`

Per `organizer-session-players.md`:

```text
SessionPlayersPage
├── PlayerCheckInPanel      # reuse Phase 6
├── QueuePanel              # reuse Phase 6; search within list
└── PlayerDetailDrawer      # overlay
```

**Edit surface rule:** no inline profile/rating editors on `PlayerRow` — drawer only.

Add dashboard nav link: **Players** → this route (header, More tab, or session status bar).

Row tap / overflow behavior per spec; payment badge tap opens drawer (payment section focus optional).

## Build — dashboard panel upgrades

### `PaymentSummaryPanel`

- Full summary tiles on payments page; on dashboard keep **compact** mode
- Wire **Mark paid** quick action on preview rows → `updatePaymentLocal`
- **View all** → payments page (already stubbed in Phase 6)

### `RecentMatchesPanel`

- Wire **View history** (done in Phase 6)
- Add **Correct** on live sessions → open correction flow or navigate to history with match selected
- Show **Result updated — stats refreshing** callout after correction

### `LeaderboardPreview` (optional stretch)

Per `leaderboard.md` § Dashboard Preview:

- Session scope, top 5 by wins
- Columns: rank, player, W-L-D, win %
- **View all** → `/organizer/leaderboard?sessionId=:sessionId`

Skip if done criteria otherwise green without it.

## Build — mutations catalog

| Mutation | Sync action | Notes |
|----------|-------------|-------|
| `updatePaymentLocal` | `UPDATE_PAYMENT` | Replaces `recordPaymentLocal` |
| `correctMatchResultLocal` | `UPDATE_MATCH_RESULT` | Triggers session recompute |
| `updatePlayerProfileLocal` | `UPDATE_PLAYER_PROFILE` | Profile fields only |

Keep using Phase 6 `updateCheckInLocal` for queue/rating/skip — drawer delegates to existing mutations.

Enqueue stable `action.id` in tests when needed. Respect ordering: correction after original `COMPLETE_MATCH` for same match.

## Build — contracts (if needed)

Add to `packages/contracts` if missing:

- `updatePaymentPayloadSchema`
- `updateMatchResultPayloadSchema` (correction)
- `updatePlayerProfilePayloadSchema`
- `leaderboardQuerySchema` (sort, direction, scope)

Align with `sync-payload-reference.md` and existing `LeaderboardEntryDto` / `PaymentSummaryDto`.

## Build — API integration (`apps/api` optional stretch)

Phase 7 **must not block** on full server coverage. Local path is required.

| Endpoint | Phase 7 priority |
|----------|------------------|
| `GET /api/v1/sessions/:sessionId/payments` | Stretch — Dexie is source during live play |
| `PATCH .../check-ins/:id/payment` | Stretch |
| `GET /api/v1/sessions/:sessionId/matches` | Stretch |
| `PATCH .../matches/:matchId/result` | Stretch |
| `GET /api/v1/sessions/:sessionId/leaderboard` | Stretch |
| `GET /api/v1/leaderboards/current` | Stretch |
| `PATCH /api/v1/players/:id` | Stretch |
| `UPDATE_PAYMENT` / `UPDATE_MATCH_RESULT` / `UPDATE_PLAYER_PROFILE` in `ProcessSyncActions` | Stretch |

Document gaps in PR notes. Supported Phase 2 replay actions (`CHECK_IN_PLAYER`, `CREATE_QUEUED_MATCH`, etc.) remain unchanged.

## Tests (required)

| Area | Examples |
|------|----------|
| `updatePaymentLocal` | Mark paid, partial, waive, refunded, reset; outbox payload; summary totals update |
| `validatePaymentTransition` | Rejects invalid refund from unpaid |
| `correctMatchResultLocal` | Win → draw correction updates stats; enqueues `UPDATE_MATCH_RESULT` |
| `recomputeSessionFromMatches` integration | Two matches; correct first; second player stats unchanged incorrectly |
| `leaderboard-snapshot` | Session scope W-L-D, win %, cancelled excluded, unscored counts as game only |
| `PlayerDetailDrawer` | Renders session + profile sections; ended mode hides save |
| `SessionPaymentsPage` | Unpaid filter; mark paid action (mocked mutation) |
| `LeaderboardView` | Session scope default with `?sessionId=`; sort by wins |
| `SessionHistoryPage` | Lists completed matches; ended hides correct button |

Keep Phase 3–6 tests passing. Target **≥25–40** new meaningful tests in `apps/web`.

Use router wrapper in page tests when `Link` / `useParams` are used.

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with new Phase 7 tests
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] `/organizer/sessions/:sessionId/payments` — full list, filters, five statuses, summary totals
- [ ] `/organizer/sessions/:sessionId/history` — match list, filters, detail, correction on live sessions
- [ ] `/organizer/leaderboard` and `?sessionId=` — club + session scopes, sort, offline from Dexie
- [ ] `/organizer/sessions/:sessionId/players` — check-in, queue tabs, drawer-only edits
- [ ] `PlayerDetailDrawer` wired from queue, payments, leaderboard, players
- [ ] **Manual smoke:** mark player paid on payments page → dashboard summary updates → mark refunded → collected decreases
- [ ] **Manual smoke:** complete match on dashboard → visible in history → correct result → leaderboard W-L-D updates
- [ ] **Manual smoke:** edit player club rating in drawer → persists after reload
- [ ] **Manual smoke (offline):** payment edit with API stopped → reload → status + outbox `UPDATE_PAYMENT`
- [ ] **Manual smoke:** ended session → payments/history/players read-only
- [ ] `sessionMode` gates mutations (no role checks)
- [ ] Payment does **not** block queueing or court assignment

## Explicitly out of scope

- **Phase 8:** full `SyncReviewPanel`, export backup UI
- Player routes, login, share session / QR, public leaderboard
- Payment gateway, receipts, accounting exports
- `requirePaymentBeforePlay` gating
- Cross-session club rating full recompute on correction (unless trivial; document limitation)
- PWA service worker
- `PlayerDetailDrawer` on court cards (optional; not required)
- New pegboard / queue / court features (Phase 6 owns live dashboard)

## Phase 8 handoff notes

Phase 8 should add **`SyncReviewPanel`**: failed/pending/blocked outbox review, retry, and conflict recovery — building on the outbox entries created in Phases 3–7 (`UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, etc.). Export backup can snapshot Dexie session tables for organizer peace of mind.

Dashboard and Phase 7 pages should expose **Review sync issues** hook (header/banner) that opens the panel when it lands.

## Constraints for the implementer

- Local store remains source of truth during live operation; server syncs when available.
- Reuse `applyMutation` — do not invent a second mutation pipeline.
- Use `@top-seed/domain` for payment transitions, stats, and leaderboard semantics.
- `PlayerDetailDrawer` is the **only** full edit surface for profile fields — not inline on lists.
- Sync action names and payloads must match `sync-actions.md`.
- Manual payment copy throughout — never “charge” or gateway language.
- If a spec conflict appears, update the relevant spec in the same change and note why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- `GET` payment/match/leaderboard endpoints + merge on connect
- `UPDATE_PAYMENT`, `UPDATE_MATCH_RESULT`, `UPDATE_PLAYER_PROFILE` in `ProcessSyncActions`
- Dashboard `LeaderboardPreview` top-5 widget
- `?status=unpaid` deep link on payments page
- Club-scope leaderboard from server with Dexie cache
- Focus payment section when opening drawer from payment row
- Session players link in `SessionHeader` / mobile More tab
