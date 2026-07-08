# Spec: Queue & Matchup Management

## Scope
Manage the live session's queue and bench, build matchups manually, and assign them to courts — all from the Dashboard (`src/app/page.tsx` → `DashboardClient.tsx`), the single live page for this feature. State is `localStorage`-backed via `src/lib/session-store.ts` (queue, bench, courts, and planning cards all persist across a reload); there is no backend and no mock/seed data — a fresh browser starts with `NoSessionState` until "Start Session" is clicked (see `docs/specs/08-sessions.md`). See "Known Gaps" in `01-player-management.md`, which applies here too.

For the smart matchup algorithm, see `07-smart-matchup.md` — it is **not yet wired to this flow** (see Matchup Planning below).

---

## Data Model (current, from `src/types/index.ts`)

```typescript
interface QueueEntry {
  id: string;
  position: number;
  player: Player;
  isInMatch: boolean;
}

interface BenchEntry {
  id: string;
  player: Player;
}

type PlanningCardState = "empty" | "proposed" | "ready";

interface MatchupSuggestion {
  sideA: (Player | null)[];
  sideB: (Player | null)[];
  pairsExhausted: boolean;
}

interface PlanningCard {
  id: string;
  matchType: "SINGLES" | "DOUBLES";
  state: PlanningCardState;
  suggestion: MatchupSuggestion | null;
}

interface ActiveMatch {
  id: string;
  courtId: string | null;
  courtName: string;
  matchType: "SINGLES" | "DOUBLES";
  sideA: Player[];
  sideB: Player[];
  startedAt: string;
}

interface Court {
  id: string;
  number: number;
  status: "AVAILABLE" | "IN_USE";
  activeMatch?: ActiveMatch;
}
```

`Player.sessionJoinedAt` is the field that drives FIFO ordering (see below); it's set once per player per session (on first entering the queue or bench) and never reset on re-queue.

---

## Dashboard Layout

Three panels render together on the Dashboard page (not separate routes):

| Component | Content |
|---|---|
| `PlayerPoolColumn` | Queue (ordered) + Bench (unordered), unified in one panel with an "Add" button opening `AddPlayersModal` |
| `MatchupColumn` (renders `PlanningCard`s) | Manually built matchup drafts, one card per prospective match |
| `CourtsSection` (renders `CourtCard`s) | Live court grid — available/in-use, elapsed time, end/void actions |

---

## Player Pool: Queue + Bench (`PlayerPoolColumn.tsx`)

### Queue
- Strict FIFO ordering by `position` (1-indexed, always contiguous, renumbered on every removal/insertion).
- Each row: position, name, skill badge, gender icon, games-played count, and (on hover/focus) actions: move to bench, remove.
- Players currently in a match hold **no** queue entry at all — it's removed on assignment and a fresh one is added back on match end (see below). There is no "in match, position held" state.
- Tap a row (when not in a match) to select it for **tap-to-place** into a planning-card slot; tapping the same row again deselects.
- Drag a row (when not in a match) onto a planning-card slot as an alternative to tap-to-place.

### Bench
- Unordered holding area for players present but not ready to queue. Carries the same `sessionJoinedAt` as the queue for FIFO purposes if/when the player later (re-)joins the queue.
- Actions: return to queue (appends via the FIFO rule below, silently — no toast), remove entirely (no undo).
- Bench players are excluded from smart-matchup candidates (per `07-smart-matchup.md`) and cannot be dragged/tap-placed into a planning card directly — dropping a bench player onto a planning-card slot first promotes them into the queue, then places them.

### FIFO re-entry rule (applies to match-end, match-void, and bench→queue)
Players returning to the queue are **always appended to the end** — never inserted ahead of anyone already waiting. When multiple players return together (e.g. both sides of an ended match), that batch is internally sorted by `sessionJoinedAt` ascending before being appended, so whoever checked into the session earliest leads within the returning group. A missing `sessionJoinedAt` sorts last within the batch.

### Adding players
The "Add" button opens `AddPlayersModal` (bulk add — see `01-player-management.md`). New players are appended to the queue via the same FIFO-append rule, in the order they were typed (using each row's staggered `sessionJoinedAt`).

---

## Matchup Planning (`MatchupColumn.tsx` / `PlanningCard.tsx`)

### What exists today
Manual matchup building only. Each `PlanningCard` represents one prospective match (`SINGLES` = 1 slot/side, `DOUBLES` = 2 slots/side, toggled in the card header). Cards are built by:
1. **Drag-and-drop**: drag a queued player's row onto an empty slot.
2. **Tap-to-place**: tap a queued player to select them, then tap any open slot across any card.

There is no automatic suggestion engine wired up despite a "Suggest" button being visible in `MatchupColumn`'s header — **it is permanently disabled**, labeled with a "Coming soon" tooltip. `07-smart-matchup.md` describes the intended algorithm; it is not implemented in the current UI.

### Card states
| State | Meaning |
|---|---|
| `empty` | No slots filled |
| `proposed` | Some but not all slots filled |
| `ready` | All slots filled — the only state from which "Assign to court" is enabled |

### Swapping and switching
- Clicking a filled slot's chip selects it; clicking another filled chip swaps the two players' positions.
- Switching a card's match type from Doubles to Singles truncates each side to its first slot, dropping any second-slot players (with an undo-capable toast).

### Assigning to a court
Clicking "Assign to court" (enabled only when `ready` and at least one court is `AVAILABLE`) reveals an inline list of available courts. Selecting one assigns **immediately** — there is no confirmation dialog for this step. The only safety net is a 5-second undo toast that reverses the assignment (restores the court, re-inserts the removed queue entries at their original position, restores the original planning card).

After assignment: the matched players' queue entries are removed entirely (not just flagged), and the assigned card is replaced by a fresh empty `DOUBLES` card so the panel always has a card available to build the next matchup.

---

## Courts (`CourtsSection.tsx` / `CourtCard.tsx`)

### States
- **`AVAILABLE`**: idle. The "New Match" button visible in this state is **permanently disabled** — starting a match must go through a planning card, not directly from the court — its tooltip explains this.
- **`IN_USE`**: shows both sides' players (name, skill badge, gender icon), an elapsed-time counter (turns warning-colored past 20 minutes), and End/Void actions.

### Ending a match
Single tap on "End Match" — **no confirmation step**. Immediately: both sides' players return to the queue via the FIFO rule above, each player's `gamesPlayed` increments by 1, the court flips back to `AVAILABLE`. A toast confirms with a 5-second undo.

### Voiding a match
Requires a confirmation step ("Void this match?" / "Confirm Void" / "Cancel") before it proceeds — the one court action in the current UI that still uses a blocking confirmation rather than undo-after-the-fact. **Voiding currently has identical bookkeeping to ending a match**, including the same `gamesPlayed + 1` increment for every voided player — there is no distinction between a legitimately completed game and a voided one in the data. A backend implementation should deliberately decide whether voided matches should count toward games played before carrying this behavior forward.

**No match result is ever recorded.** Neither ending nor voiding a match creates any persisted record of who played, the score, or who won — the court's `activeMatch` is simply discarded. `MatchResult` (`SIDE_A`/`SIDE_B`/`DRAW`) exists as a type and is used only by the separate, static `/matches` page's mock data — that page is entirely disconnected from the live Dashboard and reflects nothing that actually happens there. **This is the largest gap for a backend to close**: there is currently no write path from "a match ended on the dashboard" to any match-history record.

### Adding/deleting courts
- Add: appends a new court, numbered sequentially (`existing count + 1`).
- Delete: allowed only when `AVAILABLE` (confirmation step required); remaining courts are renumbered contiguously afterward. `ActiveMatch.courtName` exists on the type as a would-be snapshot for history, but nothing downstream needs it today since active matches are discarded on end/void rather than archived.

---

## Toast/Undo Pattern
One shared toast used across nearly every mutating Dashboard action (court assignment, match end/void, moving to bench, adding players, match-type switch): a bottom-anchored pill, auto-dismissing after 5 seconds if it carries an undo action or 2.5 seconds otherwise. Only one toast shows at a time; a new action replaces the previous toast immediately. Undo, where offered, precisely reverses the state change (e.g. re-inserting removed queue entries at their original position, not the end of the queue) rather than performing a generic "add it back."

Two exceptions with no toast/undo: bench removal and bench→queue return — both are silent, immediate, and (for removal) permanent.

---

## Known Gaps (for backend implementation)

1. **No automatic matchup suggestion** — "Suggest" is a disabled stub; only manual card-building exists today. See `07-smart-matchup.md` for the intended (not-yet-implemented) algorithm.
2. **Court numbering has no gap-preservation** — deleting a court always renumbers everything contiguously; there's no concept of a stable court identity independent of its display number beyond the `id` field itself.

Resolved since this file was first written, kept here only so the history isn't lost: match history now IS written (`match-log-store.ts`, real `MatchRecord`s); voided matches are correctly excluded from `gamesPlayed`; the Dashboard's queue/bench and `/players` are the same live `session-store.ts` data, not separate datasets. See `docs/specs/08-sessions.md` for the one gap this created — `MatchRecord.sessionId` exists but the Matches/Leaderboard pages aren't session-filtered yet.
