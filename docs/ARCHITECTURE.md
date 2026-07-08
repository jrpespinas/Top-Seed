# Architecture — Top Seed

## System Overview

Single-tenant web app. One organizer (or small team sharing credentials) manages everything. No player-facing portal.

```
Browser (Next.js)
    │
    ├── React Server Components (read)
    └── Server Actions / API Routes (write)
            │
            └── Prisma ORM
                    │
                    └── PostgreSQL
```

This is the **target** architecture. See "Current Implementation Status" immediately below for what actually exists today versus what a backend build still needs to stand up.

---

## Current Implementation Status

**No backend exists yet.** `package.json` has no Prisma, no database driver, no React Query, no Zustand, no nuqs, no NextAuth — only `next`, `react`, `react-dom`, `lucide-react`, and `motion`. Everything described below as "Server Actions / API Routes / Prisma / PostgreSQL" is the target to build toward, not something already wired up.

**All mock/seed data has been removed.** There is no `mock-data.ts` or `mock-players.ts` anymore — a fresh browser genuinely starts empty (`NoSessionState` on the Dashboard, empty `/players`, `/sessions`, `/matches`). The frontend runs on **`localStorage`-backed client state** (`src/lib/session-store.ts`, `src/lib/match-log-store.ts`), not in-memory React state — data survives a page refresh within the same browser, which is a meaningfully different (and better) starting point for the backend than "everything is thrown away."

Consequences still worth knowing before writing the backend:

1. **One shared session-scoped store, not three disconnected datasets.** `session-store.ts` is the single source for queue, bench, courts, and planning cards; `/players` and the Dashboard both read/write it, so a player added or edited on either surface is immediately visible on the other. There is no cross-session player identity — see `docs/specs/01-player-management.md` and `docs/specs/08-sessions.md` for why that's a deliberate decision, not a gap.
2. **Matches are actually recorded.** Ending or voiding a match on the Dashboard writes a real `MatchRecord` to `match-log-store.ts` (`localStorage`); the `/matches` page reads that same store and reflects it live — it is not a separate static list.
3. **Sessions are real.** `session-store.ts` also owns session start/close: closing a session archives a frozen snapshot (players, payment status, match/court counts) and clears the board; `/sessions` and `/sessions/[id]` read that archive. See `docs/specs/08-sessions.md`.

Full detail on what each page/flow currently does (and doesn't) is in `docs/specs/01-player-management.md`, `docs/specs/05-queue-matchup.md`, and `docs/specs/08-sessions.md`, each with their own "Known Gaps" section.

---

## Data Model (Prisma Schema)

```prisma
model Player {
  id          String        @id @default(cuid())
  name        String
  contact     String?       // PRD-required (see docs/PRD.md); no UI form field exists for this yet
  gender      Gender?       // built and in use in the UI; not in the original PRD
  skillLevel  SkillLevel    @default(C)
  status      PlayerStatus  @default(ACTIVE)
  notes       String?       // private organizer notes; never shown to players
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  matchPlayers      MatchPlayer[]
  payments          Payment[]
  queueEntries      QueueEntry[]
  benchEntries      BenchEntry[]
  skillLevelHistory SkillLevelHistory[]
}

model SkillLevelHistory {
  id         String     @id @default(cuid())
  playerId   String
  fromLevel  SkillLevel
  toLevel    SkillLevel
  changedAt  DateTime   @default(now())
  note       String?    // optional reason (e.g., "consistent wins vs B-level players")

  player Player @relation(fields: [playerId], references: [id])
}

model Court {
  id        String      @id @default(cuid())
  number    Int         @unique  // auto-assigned: max(number) + 1; gaps are fine after deletion
  status    CourtStatus @default(AVAILABLE)
  createdAt DateTime    @default(now())

  matches   Match[]
}

model Session {
  id          String        @id @default(cuid())
  date        DateTime      @default(now())
  status      SessionStatus @default(OPEN)
  defaultFee  Decimal       @default(0) @db.Decimal(10, 2)
  notes       String?
  createdAt   DateTime      @default(now())

  payments     Payment[]
  queueEntries QueueEntry[]
  benchEntries BenchEntry[]
  matches      Match[]
}

model Match {
  id         String       @id @default(cuid())
  sessionId  String       // all matches belong to the active session; stats are session-scoped
  courtId    String?      // nullable — set to null if court is deleted
  courtName  String       // snapshot of court name at match creation; used for display
  matchType  MatchType
  status     MatchStatus  @default(IN_PROGRESS)
  result     MatchResult? // null while IN_PROGRESS or VOIDED
  isWalkover Boolean      @default(false)
  startedAt  DateTime     @default(now())
  endedAt    DateTime?
  createdAt  DateTime     @default(now())

  session      Session       @relation(fields: [sessionId], references: [id])
  court        Court?        @relation(fields: [courtId], references: [id], onDelete: SetNull)
  matchPlayers MatchPlayer[]
}

model MatchPlayer {
  id       String @id @default(cuid())
  matchId  String
  playerId String
  side     Side

  match  Match  @relation(fields: [matchId], references: [id])
  player Player @relation(fields: [playerId], references: [id])

  @@unique([matchId, playerId])
}

model QueueEntry {
  id              String    @id @default(cuid())
  sessionId       String
  playerId        String
  position        Int
  addedAt         DateTime  @default(now())
  sessionJoinedAt DateTime  @default(now())
  // Set once on this player's FIRST entry into this session's queue or bench;
  // never overwritten by later re-queues. Drives FIFO re-entry order after a
  // match ends — see docs/specs/05-queue-matchup.md. Copied over if a bench
  // entry is promoted into the queue, rather than reset.

  session Session @relation(fields: [sessionId], references: [id])
  player  Player  @relation(fields: [playerId], references: [id])

  @@unique([sessionId, playerId])
}

model BenchEntry {
  id              String   @id @default(cuid())
  sessionId       String
  playerId        String
  addedAt         DateTime @default(now())
  sessionJoinedAt DateTime @default(now())
  // Same field and semantics as QueueEntry.sessionJoinedAt above.

  session Session @relation(fields: [sessionId], references: [id])
  player  Player  @relation(fields: [playerId], references: [id])

  @@unique([sessionId, playerId])
}

model Payment {
  id        String        @id @default(cuid())
  sessionId String
  playerId  String
  amount    Decimal       @db.Decimal(10, 2)
  status    PaymentStatus @default(UNPAID)
  notes     String?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  session Session @relation(fields: [sessionId], references: [id])
  player  Player  @relation(fields: [playerId], references: [id])

  @@unique([sessionId, playerId])
}

// F=Novice, E=Beginner, D=Upper Beginner, C=Intermediate, B=High-Intermediate, A=Advanced, S=Pro
enum SkillLevel    { F E D C B A S }
enum Gender        { M F }
enum PlayerStatus  { ACTIVE INACTIVE }
enum SessionStatus { OPEN CLOSED }
enum CourtStatus   { AVAILABLE IN_USE }
enum MatchType     { SINGLES DOUBLES }
enum MatchStatus   { IN_PROGRESS COMPLETED VOIDED }
enum MatchResult   { SIDE_A SIDE_B DRAW }
enum Side          { A B }
enum PaymentStatus { PAID UNPAID WAIVED }
```

### Notes on fields that don't map 1:1 from the current frontend

- **`sessionJoinedAt` lives on `QueueEntry`/`BenchEntry`, not `Player`.** The current frontend prototype (`src/types/index.ts`) puts an equivalent field directly on its client-side `Player` object — a shortcut that works because the prototype only ever simulates one implicit session with no real `Session` model behind it. That shortcut should **not** be carried into the backend: a real `Player` is a permanent roster entity reused across many sessions, and "when did they join *this* session's queue" is inherently session-scoped data, consistent with how `docs/PRD.md` and the rest of this document already treat session data (no cross-session aggregation). When wiring the API, map the frontend's flattened `player.sessionJoinedAt` to a join against the player's current session's `QueueEntry`/`BenchEntry`.
- **`gamesPlayed` is intentionally NOT a column anywhere in this schema.** The frontend prototype keeps a live, mutable `gamesPlayed` counter directly on its client-side `Player` object, incremented whenever a match ends or is voided on the Dashboard. That's a mock-data convenience, not a design to replicate: per "Leaderboard computed at query time" below, games-played (like every other stat) should be derived by counting `MatchPlayer` rows for that player, scoped to a session (or across sessions, if a lifetime total is ever needed) — never stored as a mutable counter that a backend would need to keep in sync by hand.
- **`gender`** is a genuine addition beyond the original PRD scope — it was added to the UI during frontend iteration (skill/gender chips, filtering, `GenderToggle` control) and is now load-bearing for the Players page and Dashboard. It needs a backend column even though `docs/PRD.md` never asked for it.
- **`contact`** is the reverse case: it's explicitly required by `docs/PRD.md` ("add a new player with name, contact number, and skill level") but no frontend form currently has a field for it — not `PlayerDrawer`, not `AddPlayersModal`. The column stays in the target schema; the frontend still needs a field added to both entry points before this is usable end-to-end.
- **Void vs. End bookkeeping is currently unresolved.** The frontend increments its mock `gamesPlayed` identically for both ending and voiding a match. Once `gamesPlayed` is a real computed value (count of `MatchPlayer` rows), this becomes a decision about whether `VOIDED` matches should be included in that count at all — decide this before the counting query is written, not after. See `docs/specs/05-queue-matchup.md`'s Known Gaps.

---

## Page Map

| Route | Status |
|---|---|
| `/` — Dashboard (courts grid + queue/bench + matchup planning); now gated on a real open session, not always-on mock data | ✅ Built |
| `/players` — Player list | ✅ Built |
| `/matches` — Match log | ✅ Built (not yet session-filtered — see docs/specs/08-sessions.md) |
| `/players/[id]` — Player profile (history + payments) | ⬜ Not built |
| `/matches/new` — Start a new match | ⬜ Not built (matches currently start only via a Dashboard planning card → court assignment) |
| `/matches/[id]` — Match detail / score entry | ⬜ Not built |
| `/leaderboard` — Rankings | ⬜ Not built |
| `/sessions` — Session list | ✅ Built (simpler than originally planned — see docs/specs/08-sessions.md for the gap vs. `06-payment-tracking.md`'s target) |
| `/sessions/[id]` — Session detail (players + payment snapshot) | ✅ Built |
| `/sessions/[id]/payments` — Payment tracking | ⬜ Not planned as a separate route — folded into `/sessions/[id]` instead, matching this app's shallow routing elsewhere |
| `/settings` — App settings | 🟡 Only "Reset all data" built (clears every `top-seed:*` localStorage key); default fee, matchup card count, etc. still not built |

No dedicated `/courts` route exists or is planned — per `docs/PRD.md`, court management is deliberately dashboard-inline only (add/delete via the Dashboard's Courts panel). This isn't a gap to fill; it's a settled decision.

---

## Key Design Decisions

**Server Actions over API Routes for mutations** — colocated with forms, automatic revalidation, less boilerplate. API routes only for data that needs to be fetched by external tools. *(Target — no server actions or API routes exist yet; every mutation today is a client-side state update.)*

**Session-scoped queue** — queue belongs to a Session, not a global state. Organizer opens/closes sessions, which scopes payments and queue together. *(Target — there is no `Session` entity in the running app today; the Dashboard behaves as if exactly one implicit session is always open.)*

**Match result stored directly** — `Match.result` (`SIDE_A | SIDE_B | DRAW`) is set on end. No score tracking; no derivation needed. *(Target — no match result of any kind is recorded today; see Current Implementation Status.)*

**Players soft-delete; courts hard-delete** — `Player.status` preserves history. Courts are hard-deleted; `Match.courtName` snapshots the name at creation so historical records remain accurate. *(Player soft-delete via `status` is built. Court hard-delete is built. The `Match.courtName` snapshot has no effect yet since no match records are ever created.)*

**Leaderboard computed at query time** — no materialized ranking table. PostgreSQL aggregation is fast enough for hundreds of players. Add a view if it becomes slow. *(Target — this is also the reasoning for why `gamesPlayed` must not become a stored column; see the Data Model notes above.)*

---

## State Management

| State Type | Tool |
|---|---|
| Server/DB state | React Query (`useQuery`, `useMutation`) |
| UI-only state (modals, forms) | Local `useState` |
| Cross-component UI (queue drag state) | Zustand |
| URL state (filters, tabs) | `nuqs` (type-safe searchParams) |

*(Target. None of these libraries are installed today — every page currently manages all of its state, including what this table calls "server/DB state," with plain `useState`/`useCallback` in a single client component per page. Introducing React Query and Zustand is part of the backend integration work, not something to retrofit before the backend exists.)*

---

## Responsive Layout Strategy

- **Dashboard**: Single column on mobile, multi-column on tablet/desktop. Three panels — Player Pool (queue + bench), Matchup Planning, and Courts — with Courts rendered first in DOM order on mobile so it's the first thing an organizer sees on a phone.
- **Court cards**: Vertical grid on desktop; a horizontally-scrolling snap strip on tablet-width layouts; single column on mobile.
- **Player Pool & Matchup Planning**: stacked on mobile; side-by-side panels on tablet+.
- **Tables** (players list, match log, leaderboard): Horizontal scroll on mobile, full table on tablet+.

---

## Performance Targets
- Dashboard load: < 1s (server-rendered)
- Match start action: < 500ms round-trip
- Leaderboard query: < 200ms (add index on `Match.status`, `MatchPlayer.playerId`)

*(Targets for once the backend exists. There is currently no network round-trip to measure — all Dashboard actions are synchronous client-state updates.)*
