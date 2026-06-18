# Phase 4 — UI primitives + domain components

Implement **Phase 4 only**: design tokens, accessible UI primitives (Radix + Tailwind), reusable domain components, shared formatters, and a dev component gallery in `apps/web`. Do **not** implement live dashboard features, session lifecycle pages, sync review panel, `dnd-kit`, or route-level data loading.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

**Prerequisites (must exist before this phase):**

| Phase | Delivers |
|-------|----------|
| **0** | Monorepo, contracts, Fastify health, web shell, base Tailwind colors |
| **1** | `packages/domain` pure rules + tests |
| **2** | Server use cases + sync API (for realistic fixture shapes) |
| **3** | Dexie, outbox, `OfflineBanner` / `SyncStatusBadge` stubs, dev harness |

This phase gives Phases 5–6 a **stable visual language** and reusable building blocks. Feature panels (`PlayerCheckInPanel`, `CourtBoard`, etc.) compose these components later — they are not built here.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/frontend/frontend-stack.md` — **authoritative** for Radix, Tailwind, component folder model
3. `docs/specs/frontend/frontend-technical-standards.md` — **authoritative** for tokens, units, touch targets, typography
4. `docs/specs/frontend/design-system.md` — semantic color intent, pegboard tone, mobile rules (skim)
5. `docs/specs/frontend/component-architecture.md` — component layers (`ui` vs `features`)
6. `docs/specs/frontend/components/README.md` — primitives vs domain boundary
7. `docs/specs/mvp-access.md` — `sessionMode` (`live` vs `ended`) for disabled actions

**Read each component spec before implementing that component** (paths below). Do **not** read dashboard feature specs (`queue-panel.md`, `court-board.md`, `player-check-in-panel.md`, etc.) in this phase.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` only |
| Primitives behavior | **Radix UI** — Dialog, Drawer/Sheet, Tabs, DropdownMenu, Select, Toast (or equivalent) |
| Styling | **Tailwind CSS** mapped to semantic CSS custom properties |
| Component pattern | shadcn-style: copy/adapt patterns into `components/ui/`, restyle with Top Seed tokens |
| Formatters | Shared `lib/format/` — money, durations, status labels, dates |
| Testing | Vitest + **@testing-library/react** + `jsdom` for component behavior |
| Icons | Lucide React (or similar lightweight set) — optional, no decorative shuttle branding |

**Do not use:** Material UI, Ant Design, drag-only libraries, CSS-in-JS as primary styling, Redux/MobX.

**Do not add `dnd-kit` in this phase** — button/menu assignment alternatives only; desktop drag is Phase 6/8 optional stretch.

## Suggested `apps/web` layout

Reorganize Phase 3 stubs into the layered structure from `frontend-stack.md`:

```text
apps/web/src/
  components/
    ui/                    # primitives (no badminton domain logic)
      button.tsx
      card.tsx
      dialog.tsx
      drawer.tsx
      tabs.tsx
      ...
    domain/                # reusable badminton/payment/queue display components
      player-row.tsx
      court-card.tsx
      match-card.tsx
      payment-badge.tsx
      status-badge.tsx
      sync-status-badge.tsx   # migrate from Phase 3 stub
      offline-banner.tsx      # migrate from Phase 3 stub
      metric-card.tsx
  lib/
    format/
      money.ts
      duration.ts
      status-labels.ts
      datetime.ts
    cn.ts                    # clsx + tailwind-merge helper
  pages/dev/
    ComponentGallery.tsx     # DEV-only showcase route
```

Keep existing `db/`, `sync/`, `mutations/`, `hooks/` from Phase 3 unchanged except import path updates for moved banner/badge files.

## Build — design tokens

Expand `index.css` and `tailwind.config.js` per `frontend-technical-standards.md`:

| Token group | Minimum |
|-------------|---------|
| `--color-*` | Existing semantic colors + `surface`, `court`, `next`, `attention` roles from `frontend-stack.md` |
| `--space-*` | `--space-1` … `--space-8` (rem-based) |
| `--text-*` / `--font-*` | `caption`, `body`, `label`, `title`, `heading`, `display` |
| `--radius-*` | `--radius-control`, `--radius-card` |
| `--size-*` | Minimum touch target `2.75rem` (44px) for courtside controls |

Rules:

- Components consume tokens — no magic `px` spacing except hairline borders.
- Use `tabular-nums` for scores, money, queue positions, wait times.
- Tablet-first sizing; adapt down to phone and up to desktop.

## Build — UI primitives

Implement per spec in `docs/specs/frontend/components/primitives/`. Each primitive: variants, sizes, accessible states, tests.

| Component | Spec | Notes |
|-----------|------|-------|
| `Button` | `button.md` | `primary` / `secondary` / `tertiary` / `danger` / `ghost`; `isLoading` |
| `IconButton` | `icon-button.md` | Pair with visible text for critical actions |
| `Card` | `card.md` | Surface + header/body/footer slots |
| `Dialog` | `dialog.md` | Radix; focus trap |
| `Drawer` | `drawer.md` | Bottom on mobile, right on tablet+; sticky footer slot |
| `ConfirmAction` | `confirm-action.md` | Composes `Dialog`; `danger` variant |
| `Tabs` | `tabs.md` | For future mobile pegboard tabs |
| `DropdownMenu` | `dropdown-menu.md` | Row overflow actions |
| `Select` | `select.md` | Session settings forms (Phase 5) |
| `FormField` | `form-field.md` | Label + hint + error wiring |
| `SearchInput` | `search-input.md` | Player search affordance |
| `DataList` | `data-list.md` | Dense scrollable lists |
| `EmptyState` | `empty-state.md` | No players / no courts copy |
| `Toast` | `toast.md` | Success/error feedback (provider at app root) |

Primitives must:

- Accept data and callbacks through props only — **no API calls, no Dexie**.
- Expose keyboard focus and ARIA labels.
- Use Top Seed tokens, not default shadcn zinc palette.

## Build — domain components

Implement per spec in `docs/specs/frontend/components/domain/`. Props-only; parents pass data from Dexie/API later.

| Component | Spec | MVP variants to implement |
|-----------|------|-------------------------|
| `StatusBadge` | `status-badge.md` | `queue`, `court`, `match` types with canonical labels |
| `PaymentBadge` | `payment-badge.md` | All payment statuses; shared `formatMoney` |
| `SyncStatusBadge` | `sync-status-badge.md` | Migrate Phase 3 stub; full spec compliance |
| `OfflineBanner` | `offline-banner.md` | Migrate Phase 3 stub; spec copy verbatim |
| `MetricCard` | `metric-card.md` | `neutral` / `warning` / `success` tones |
| `PlayerRow` | `player-row.md` | `queue`, `payment`, `search`, `token`, `compact` |
| `CourtCard` | `court-card.md` | Team A/B slots; states `open` → `inProgress` |
| `MatchCard` | `match-card.md` | `queued`, `queuedIncomplete`, `active`, `completed`, `history` |

**Domain component rules** (from `components/README.md`):

- No direct `fetch`, TanStack Query, or Dexie inside components.
- Optional `sessionMode: 'live' | 'ended'` prop disables mutating actions when session is read-only.
- Movement actions use **buttons/menus** (`Add to next match`, `Move to court`) — not drag-only.
- Use `StatusBadge` for domain status; `SyncStatusBadge` for sync metadata only.

## Build — shared formatters

`lib/format/` helpers used by domain components:

| Helper | Purpose |
|--------|---------|
| `formatMoney(amount, currency)` | Session fee / payment display |
| `formatWaitDuration(checkedInAt, now?)` | `12 min` style queue wait |
| `formatQueueStatus(status)` | Canonical UI label, not raw enum |
| `formatCourtStatus(...)` | Maps backend court + match → UI state |
| `formatDateTime(iso)` | Shared timestamp display |

Inject `now` in tests; do not hardcode `Date.now()` in presentation-only formatters if it complicates testing.

## Build — dev component gallery

Add a **DEV-only** route (e.g. `/dev/components`, `import.meta.env.DEV` guard):

- Sections for each primitive variant matrix (button sizes, badge tones, etc.).
- Domain component fixtures with realistic mock props (names, court states, payment edge cases).
- Touch-target spot check note for `Button` `large` on narrow viewport.
- Link from existing dev harness or sessions page footer.

This replaces ad-hoc stub styling review before Phase 6 dashboard work. Storybook is optional stretch, not required.

## Build — migrate Phase 3 stubs

- Move `OfflineBanner.tsx` and `SyncStatusBadge.tsx` under `components/domain/`.
- Update imports in `LocalSessionDevHarness` and elsewhere.
- Align copy and props with component specs (pending/failed counts, `onReview` no-op OK).
- Keep behavior wired to `useSyncEngine` in the harness — gallery uses static fixtures.

## Tests (required)

| Area | Examples |
|------|----------|
| Primitives | Button variants; disabled/loading blocks click; Dialog focus trap smoke |
| Formatters | Money, wait duration, status label mapping |
| Domain | `PlayerRow` queue variant renders name + status; `CourtCard` shows Team A/B slots |
| `PaymentBadge` | All five payment statuses render readable text |
| `OfflineBanner` | Offline / pending / failed copy per spec |
| `StatusBadge` | Known queue statuses map to canonical labels |

Configure Vitest `environment: 'jsdom'` for component tests (can use a separate `vitest.component.config.ts` or `// @vitest-environment jsdom` per file). Keep Phase 3 `node` + `fake-indexeddb` tests working.

**Target:** at least **25–40** meaningful component/formatter tests in `apps/web` (Phase 3 db/sync tests remain separate).

## Done when

- [ ] `pnpm --filter @top-seed/web test` passes with ≥25 tests including component + formatter coverage
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `pnpm test` at repo root still passes
- [ ] All 14 primitives + 8 domain components listed above exist under `components/ui/` and `components/domain/`
- [ ] Tokens documented in `index.css` (comment block listing groups)
- [ ] Radix primitives used for Dialog, Drawer, Tabs, DropdownMenu (behavior accessible by default)
- [ ] **Manual smoke:** open `/dev/components` — variants render; tap targets feel usable on mobile viewport
- [ ] **Manual smoke:** dev harness still shows migrated `OfflineBanner` + row `SyncStatusBadge`
- [ ] No dashboard feature components, session CRUD pages, or `dnd-kit`

## Explicitly out of scope

- **Phase 5:** `/organizer/sessions` list, `/organizer/sessions/new`, session create flow
- **Phase 6:** `PlayerCheckInPanel`, `QueuePanel`, `CourtBoard`, `NextQueuePanel`, `ActiveMatchPanel`, `SessionHeader`, pegboard layout
- **Phase 7:** payments page, leaderboard, match history panels
- **Phase 8:** full `SyncReviewPanel`, export backup UI
- `dnd-kit` and drag-only player movement
- PWA service worker / Workbox
- Player-facing routes, login, payment gateway UI
- Wiring components to live Dexie session data (fixtures/mocks only in gallery; harness may keep Phase 3 wiring)
- New sync mutations or API endpoints

## Phase 5–6 handoff notes

When this phase is complete, Phase 5 should compose `FormField`, `Select`, `Button`, `Card` for session forms. Phase 6 should compose `PlayerRow`, `CourtCard`, `MatchCard`, `Tabs`, `Drawer` inside feature panels without inventing one-off styles.

## Constraints for the implementer

- Read the individual component spec **before** coding that component.
- Prefer boring, explicit props over context magic.
- Do not fetch session data inside reusable components.
- If a spec conflict appears, update the relevant spec in the same change and note why.
- Do **not** create git commits unless the user asks.

## Optional stretch (only if done criteria are green)

- Storybook or Ladle for primitives
- `@radix-ui/react-visually-hidden` for sr-only helpers
- Dark mode token scaffold (not required for MVP)
- `PlayerRow` `token` variant with mocked assignment menu actions in gallery
- Visual regression snapshot for `CourtCard` states (single fixture)
