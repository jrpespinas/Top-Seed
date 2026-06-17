# Phase 1 — Domain core (pure rules + tests)

Implement **Phase 1 only**: business rules in `packages/domain` with comprehensive Vitest coverage. Do **not** implement HTTP routes, Prisma models/migrations, Dexie, sync replay, React UI, or dashboard features.

## Product context

Top Seed is an organizer-only, local-first badminton open-play queueing web app (MVP v1). Read `AGENTS.md` for north star and boundaries.

Phase 0 is complete: pnpm monorepo, `packages/contracts`, Fastify health check, empty web shell. This phase makes badminton fairness and pegboard rules **testable without a server**.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/backend/state-transitions.md` — **authoritative for pegboard transitions and invariants**
3. `docs/specs/backend/queueing-and-ratings.md` — suggestion scoring, determinism, `queueMode`, `suggestionExcluded`
4. `docs/specs/backend/match-results-and-ratings.md` — outcomes, W-L-D, win rate, rating deltas, correction rules
5. `docs/specs/backend/payments.md` — payment statuses, validation, session totals
6. `docs/specs/backend/domain-model.md` — entity fields (skim for types; do not implement persistence)
7. `docs/specs/backend/backend-architecture.md` — domain layer boundaries only (skim)

Do **not** read frontend feature specs, `sync-actions.md`, or `api-spec.md` in this phase unless a type name is ambiguous.

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `packages/domain` only (minor `packages/contracts` enum alignment only if unavoidable) |
| Language | TypeScript `strict: true` |
| Testing | Vitest unit tests only — **no database, no HTTP** |
| Imports | **Forbidden:** `@prisma/client`, `fastify`, `react`, `dexie`, `apps/*` |

Domain code must be **pure functions**: given input state → return result or structured validation errors. No `Date.now()` inside scoring unless injected as a parameter.

## Suggested package layout

Organize by policy area; names can vary if clearer:

```text
packages/domain/src/
  types/              # Domain entities/value objects (not API DTOs)
  queue/              # Suggestion pool, scoring, determinism
  transitions/        # State transition validators + next-state helpers
  ratings/            # Rating deltas, clamping, casual vs rated
  stats/              # Leaderboard stats, win rate, match-outcome effects
  payments/           # Payment transition validation + session totals
  index.ts            # Public exports
```

Update `packages/domain/README.md` with module map and usage notes for Phase 2.

## Build — queue suggestion engine

Implement deterministic doubles suggestion per `queueing-and-ratings.md`:

- **Inputs:** checked-in players, recent matches in session, active court matches, staged queued matches, `session.queueMode`.
- **Eligibility:** `waiting` players; `resting` only when waiting pool cannot form four; exclude `playing`, `done`, `removed`, active court assignment; exclude `suggestionExcluded`; **do not** exclude unpaid/partial; **do not** exclude players merely staged in other lanes.
- **`queueMode: manual`:** return no suggestion (null/empty), not an error.
- **Scoring:** centralized weights for `waitPriority`, `teamBalance`, `repeatPenalty`, `restPenalty`, `arrivalFairness` using the documented formula.
- **Tie-breakers (in order):** longest wait → fewest session matches → earliest arrival → lexical player id.
- **No randomness** unless an explicit future shuffle API exists (it does not in MVP).

Export functions such as `buildSuggestion(sessionSnapshot)` that return four players + recommended team split + explainable score breakdown (for tests and future UI).

## Build — state transitions

Pure validators/helpers for `state-transitions.md` tables:

**Players (`CheckIn.queueStatus`)**

- Check-in → `waiting`
- Add to queued match → `assigned`; fourth player upgrades queued match `draft` → `ready`
- Promote to court, start, complete, cancel paths per spec
- Post-match: return to `waiting` immediately; **never** auto-`resting`
- If still in another `draft`/`ready` queued match after complete → stay `assigned`
- Block `done`/`removed` while `playing`
- `resting` / back-to-waiting are organizer-only

**Queued matches**

- `draft` (<4 players) / `ready` (4) / `promoted` / `removed`
- Only `ready` may promote
- On promote: remove same player from other lane slots; downgrade affected matches below 4 to `draft`

**Matches & courts**

- `assigned` → `in_progress` → `completed`; cancel releases court
- One active match per court; court `open` ↔ `occupied`
- Paused/unavailable courts reject new assignments

**Session**

- Complete blocked while any match `assigned` or `in_progress`
- Complete marks `waiting`/`resting` → `done`

Return structured results, e.g. `{ ok: true, nextState }` or `{ ok: false, code: 'COURT_ALREADY_OCCUPIED' }` using error codes from `api-contracts.md` where applicable.

## Build — match outcomes, stats, ratings

Per `match-results-and-ratings.md`:

| Outcome | Stats (W/L/D played) | Win-rate denominator | Rated session ratings |
|---------|----------------------|----------------------|------------------------|
| `team_one_win` / `team_two_win` | W+L | Yes | Yes |
| `draw` | D | Yes | Small expectation-based delta (cap 0.03) |
| `unscored` | played only | No | No |
| `cancelled` | none | No | No |

- Win rate: `wins / (wins + losses + draws)`; `null` when denominator is 0.
- Rated deltas: even win ±0.05; underdog win up to ±0.10; favored win ±0.02; draw per spec; clamp ratings to `1.0`–`5.0`.
- `casual` sessions: update stats, **no** rating changes.

**Correction (domain only):** function to recompute affected players' stats and ratings from a corrected match **forward in chronological order** within a session. Cross-session recompute may be stubbed with a clear comment if too large for one pass — prefer at least session-scoped recomputation tests.

## Build — payments

Per `payments.md`:

- Validate transitions: `unpaid`, `partial`, `paid`, `waived`, `refunded`, reset-to-unpaid (mistake correction).
- Rules: non-negative amounts; `paid` requires `paymentAmountPaid >= paymentAmountDue` (unless due is 0); `partial` is `0 < paid < due`; `refunded` after `paid`/`partial` excludes from collected totals.
- `computePaymentSummary(checkIns, sessionFee, currency)` → `expectedTotal`, `collectedTotal`, `unpaidTotal`, `waivedTotal`, `refundedTotal`, `countsByStatus`.
- **Do not** implement `requirePaymentBeforePlay` gating (MVP always informational).

## Tests (required)

Use the **Test Scenarios** sections at the bottom of:

- `queueing-and-ratings.md`
- `match-results-and-ratings.md`
- `state-transitions.md`

Add payment validation/summary tests aligned with `payments.md`.

**Target:** at least **30–50** meaningful tests. Prefer table-driven cases with readable fixture names. No snapshot tests of entire JSON blobs unless helpful.

Each major policy file should have a matching `*.test.ts`.

## Done when

- [ ] `pnpm --filter @top-seed/domain test` passes with ≥30 domain tests
- [ ] `pnpm --filter @top-seed/domain build` succeeds
- [ ] `pnpm test` at repo root still passes (other packages unchanged or trivially updated)
- [ ] No forbidden imports in `packages/domain`
- [ ] Suggestion engine is deterministic: same snapshot → same suggestion
- [ ] `packages/domain/README.md` documents public API for Phase 2 use cases
- [ ] `apps/api` and `apps/web` behavior unchanged (no new routes or UI)

## Explicitly out of scope

- Fastify routes, Prisma schema/migrations, repositories, use cases
- `POST /api/v1/sync/actions` or any sync replay
- Dexie, outbox, TanStack Query offline kernel
- React components, pages, Storybook
- Login, player self-service, payment gateway
- `requirePaymentBeforePlay`, export backup, tournaments, multi-sport
- Auto-fill / Magic Queue / random shuffle
- Persisting rejected suggestions
- Full cross-session rating history rebuild (session-scoped minimum is enough)

## Constraints for the implementer

- Prefer boring, explicit code over clever abstractions.
- Keep scoring weights in one module with constants — easy to tune later.
- Domain types are **not** API DTOs; Phase 2 maps domain ↔ `packages/contracts`.
- If a spec conflict appears, fix the spec in the same change and note why (unlikely if you read the bundle above).
- Do **not** create git commits unless the user asks.

## Optional stretch (only if core tests are green)

- Property-style test: promote always clears duplicate lane slots
- Explainability helper: human-readable reason string for top suggestion
- Golden fixture file for one full session night (check-in → suggest → promote → complete)
