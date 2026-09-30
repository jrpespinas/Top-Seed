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
| `PlayerPoolColumn` | Queue (ordered) + Bench (unordered), unified in one panel with an "Add" button opening `AddPlayersModal`. Desktop grid is `[21fr_21fr_58fr]` — Courts still leads (the live match is what gets read at a glance) and renders its cards **two-up from `xl:`**. 70% was more than the split-sides card could use: at a 1388px viewport it bought 447px cards while Players and Matchups sat on their ~200px floor. 58% still yields ~368px per card two-up. Two-up starts at `xl:` rather than `lg:` because at 1024px the panel is ~557px, and splitting that gives 262px cards — too narrow for the card's two halves, where one 537px card reads far better. `cols={2}` means "two-up once there's room", not always two: the same `CourtsSection` instance renders the mobile list. |
| `MatchupColumn` (renders `PlanningCard`s) | Manually built matchup drafts, one card per prospective match |
| `CourtsSection` (renders `CourtCard`s) | Live court grid — available/in-use, elapsed time, end/void actions |

### Court card variants (`CourtCard`)
`variant="wide"` is the default: the two sides sit as half-columns either side of a dashed centre divider with a `VS` pill, each player showing their name above a full-label `SkillBadge` in its `dense` size ("Intermediate" in its tier colour, not `Int`). Used by the desktop courts column and by mobile, both of which give the card enough width.

`variant="compact"` — the original stacked treatment with an inline `vs` — survives only for the tablet `horizontal` strip, whose cards are `w-44` (176px): too narrow to split into halves without the full-label badges wrapping.

**Interaction is identical in both variants.** `PlayerRow` keeps every drag, tap, armed-state, keyboard and `canDrop` behavior; only the arrangement of rows changes.

---

## Player Pool: Queue + Bench (`PlayerPoolColumn.tsx`)

### Queue
- Strict FIFO ordering. `QueueEntry.position` is still maintained in the model (1-indexed, contiguous, renumbered on every removal/insertion) but is no longer rendered.
- Each player renders as a **bordered card** (border, rounded, faint elevated fill) stacked one-wide, not a divider row — the Players column is 15% of the grid and never fits two across. Each card is **three lines**: (1) position, name, gender icon, and a pill showing waiting time; (2) skill badge, games played, and the Playing/Matched/Selected status pill; (3) the actions. Two lines still collided at a 15%-wide column — badge, status pill and three buttons all competed for one line — so actions get their own row, which is what buys them readable labels and a real tap target. Density is traded away deliberately.
- Actions are **labelled text, always visible**, not hover-revealed icons: `Edit`, `Rest` (queue rows → bench, with a cup icon), `Queue` (bench rows → queue), and a right-aligned icon-only `×` for remove. "Rest" replaced a pause glyph that read as pausing the wait timer rather than benching the player. Remove keeps its two-step confirm, now spelled `Remove` / `Keep`. Both actions also scrub the player out of any planning card they're currently slotted in (a card doesn't lock a player in place any more than the queue does) — a card that drops below full reverts from `ready`/ `proposed` to `proposed`/`empty` accordingly.
- Players currently in a match hold **no** queue entry at all — it's removed on assignment and a fresh one is added back on match end (see below). There is no "in match, position held" state.
- **A player placed in a matchup card leaves the player column entirely.** Seeing the same person in the queue and in a card at once was the confusion. An earlier collapsed **"In a matchup"** group below the queue was removed for the same reason: it was still a second copy of someone already visible in their card. Nothing is lost. Placement never removes the queue entry, so taking a player out of the card (its × button) returns them to the Queue list with their wait time and check-in seniority intact, where Edit, Rest and Remove are all available. When everyone waiting is placed, the Queue section says so ("Everyone's in a matchup or on court") instead of the filter-empty message.
  - This is a **render filter only** — the `QueueEntry` is never touched. `enteredQueueAt` keeps running and `sessionJoinedAt` holds its FIFO seniority, so a player's waiting time and games-played are continuous if they come back out of a card. Only an ended or voided match changes those. Removing and rebuilding the entry on placement is exactly where they would have reset.
  - Bench players are never in this group: placing one promotes them to the queue first, so bench ∩ carded is empty.
- **Rows no longer show a position number.** List order still carries true FIFO — the number was the tidiness cost of hiding carded players. Note the interaction with sorting: in the default Queue Order sort, order *is* the queue; under a Games or Skill sort there's no longer a per-row indicator of who's actually next.
- Tap a row (when not in a match) to select it for **tap-to-place** into a planning-card slot; tapping the same row again deselects.
- Drag a row (when not in a match) onto a planning-card slot as an alternative to tap-to-place.

### Queue: sort & filter
A sort/filter icon button sits next to "Add" and opens a popover (portaled, positioned under the trigger; spans the viewport width with a small gutter below `sm:`) — plain buttons and chips, not menu semantics, since multiple selections happen without closing the popover:
- **Sort keys** (radio-style, one active at a time): Queue Order (default — the true FIFO order), Games Played (default ascending — fewest first), Waiting Time (default ascending — longest-waiting first, by `enteredQueueAt`, matching the `ElapsedTimer` already shown per row; distinct from `sessionJoinedAt`, which drives FIFO re-entry seniority, not this sort), Skill Level (default ascending — strongest first, `S → F`). Re-picking the active key toggles its direction; picking a different key resets to that key's ascending default.
- **Skill-level filter**: multi-select chips (`S A B C D E F`), same chip styling as the Players page.
- Applies to the **Queue section only** — Bench is always shown in full, unaffected.
- Regardless of display sort, each row **always shows its true FIFO position** (computed once from the unsorted queue before any sort/filter is applied) — the display order and the position number can diverge on purpose.
- A "Sorted by X" / "N hidden" indicator with a one-tap Reset appears next to the Queue count whenever a non-default sort or any filter is active.
- Local UI state only (`useState` in `PlayerPoolColumn`) — not persisted across reloads, not synced with the Players page's independent sort/filter state.

### Bench
- Unordered holding area for players present but not ready to queue. Carries the same `sessionJoinedAt` as the queue for FIFO purposes if/when the player later (re-)joins the queue.
- Actions: return to queue (appends via the FIFO rule below, silently — no toast), remove entirely (no undo). Remove also runs the same planning-card cleanup queue-remove does — belt-and-suspenders, since a bench entry is promoted into the queue before ever reaching a card (see below), so a bench player shouldn't actually be reachable from a card's suggestion in practice.
- Bench players are excluded from smart-matchup candidates (per `07-smart-matchup.md`) and cannot be dragged/tap-placed into a planning card directly — dropping a bench player onto a planning-card slot first promotes them into the queue, then places them.

### FIFO re-entry rule (applies to match-end, match-void, and bench→queue)
Players returning to the queue are **always appended to the end** — never inserted ahead of anyone already waiting. When multiple players return together (e.g. both sides of an ended match), that batch is internally sorted by `sessionJoinedAt` ascending before being appended, so whoever checked into the session earliest leads within the returning group. A missing `sessionJoinedAt` sorts last within the batch.

### Session header count
The header reads "N players · X of Y courts in use". **N counts queue + bench + everyone on a court**, deduped by player id — court assignment removes a player's queue entry, so the earlier `queue.length + bench.length` silently omitted everyone currently playing (it showed "5" with 8 people mid-match). Players in a matchup card keep their queue entry and were never missing.

### Adding players
The "Add" button opens `AddPlayersModal` (bulk add — see `01-player-management.md`). New players are appended to the queue via the same FIFO-append rule, in the order they were typed (using each row's staggered `sessionJoinedAt`).

---

## Matchup Planning (`MatchupColumn.tsx` / `PlanningCard.tsx`)

### What exists today
Each `PlanningCard` represents one prospective match (`SINGLES` = 1 slot/side, `DOUBLES` = 2 slots/side, toggled in the card header). Every slot — both sides, all indices — renders as soon as a card exists, empty or not, so placement is always slot-precise: dropping or tapping onto a specific slot puts the player exactly there, in any order, with no requirement to fill Side A before Side B. Cards are built by:
1. **Suggest** — `MatchupColumn`'s header button fills every card that isn't already `ready` in one pass (full generate for `empty` cards, lock-and-fill for `proposed` ones — placed players stay put, only open slots are searched), per the algorithm in `07-smart-matchup.md`. The per-card `↺ Resuggest` icon does the same, scoped to just that one card.
2. **Drag-and-drop**: drag a queued player's row onto a specific slot; that slot (and only that slot) highlights while hovering it.
3. **Tap-to-place**: tap a queued player to select them, then tap the slot — on any card, either side — you want them in.

Either gesture works on an **occupied** slot too, where it **replaces** the current occupant rather than swapping: the incoming player takes the slot, and the displaced player simply stays in the queue, since every card occupant already has a queue entry behind it. Plain placement into an empty slot is silent; a replace shows an undo-capable toast (*"Ivy replaced Jon in the matchup"*), because someone lost their spot.

### Card states
| State | Meaning |
|---|---|
| `empty` | No slots filled |
| `proposed` | Some but not all slots filled |
| `ready` | All slots filled — the only state from which "Assign to court" is enabled |

### Relocating and swapping placed players
- An already-placed player can be moved by **drag** (each chip is its own drag source) or by **tap** (tap the chip to select it, then tap a destination slot) — either way, the destination can be any slot on any card, not just within the same card.
- Dropping/tapping a selected chip on an **empty** slot relocates them there. Dropping/tapping on an **occupied** slot swaps the two players — same-card or across two different cards.
- Chip selection is global, not per-card: only one position anywhere on the Dashboard is armed at a time — picking one clears the other. While a chip is selected, its origin card shows a "Tap a slot to move, or a player to swap" hint with a Cancel button; tapping the same chip again also deselects it.

**Which origins each drop target accepts.** Drag targets only highlight for origins they can actually accept — a target that lights up and then refuses the drop is worse than one that never lights up. Because the drag payload is unreadable during `dragover`, the origin kind rides in a valueless `application/x-endpoint-<kind>` MIME type, read via `dragEndpointKind()`:

| Target | Accepts | Rejects |
|---|---|---|
| Empty card slot | queue, bench, card | **court** — a live match can't be left short |
| Occupied card chip | queue, bench, card, court | — |
| Live court player row | queue, bench, card, court | — |
| Queue / bench row | court | everything else — the pool isn't manually reorderable |
- Dragging or tapping a chip onto its own current slot is a no-op.
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

### Swapping and substituting a player mid-match
An `IN_USE` court's player rows are **both swap sources and swap targets**, not just a read-out. Reuses the same drag-target/tap-target treatment as an occupied planning-card slot (`ring-1 ring-primary/60 bg-primary/15` drag-over state).

**Inbound (substitution).** Drag a queue/bench row, or drag/tap-place an already-placed chip from a planning card, directly onto a live match's player row to swap them in.

**Outbound (swap).** Tap or drag a live court player to arm them, then pick any *occupied* position to trade places with — another slot on the same court (flip sides / swap partners), a slot on a different live court, a planning-card chip, or a queue/bench row. The armed court card shows a "Tap a player to swap" hint with a Cancel button, mirroring the planning-card chip banner. This exists so reshuffling a live match doesn't require Void, which credits `gamesPlayed` to everyone and so costs real data.

Two rules govern the outbound direction:
1. **A court player can swap, but never just leave.** Empty planning-card slots are rejected — they stay visually inert during a drag and show *"A live match can't be left short — swap with a player instead."* on a tap. Every downstream consumer (End Match crediting, the who-won buttons) assumes a full roster. Pulling someone out with no replacement is still Void/End's job.
2. **The drop target decides where the outgoing player lands.** Onto a queue row → they take that queue position; bench → bench; card chip → that card slot, with a queue entry created. The inbound direction keeps its old rule (substituted-out players always go to the **bench**), because it never named a destination.

There is **no mid-match guard** — a swap 20 minutes in is allowed. Credit follows the roster at End/Void time regardless (see below), and a 5-second undo toast is the safety net, consistent with every other reversible Dashboard action.

**Implementation.** All of this resolves through one pure function, `resolveSwap(state, from, to)` in [`src/lib/roster-swap.ts`](../../src/lib/roster-swap.ts), over a single `Endpoint` address type (`queue | bench | card | court`). The Dashboard holds one `selection: Endpoint | null` rather than a state per source kind, and every drag carries one `application/x-endpoint` payload (plus a valueless `application/x-endpoint-<kind>` type, since `getData` is blocked during `dragover` and empty slots need to know a court drag is in flight to stay inert). Undo restores the whole prior roster snapshot rather than reconstructing an inverse per case.

- **The outgoing player goes to bench**, not the queue — leaving a live match is treated as resting, not re-queueing for another game.
- **The match's identity is untouched**: same `activeMatch.startedAt`, same elapsed-time counter. This is a roster correction, not a new match.
- **Credit follows the roster at End/Void time**, unchanged from the existing behavior — `MatchRecord.sideA`/`sideB` (and therefore `gamesPlayed`, derived from the match log) is built from whatever `activeMatch.sideA`/`sideB` holds *when the match ends or is voided*, not who started it. A substituted-in player who finishes the match gets credit; a substituted-out player who left early does not. No extra bookkeeping was needed to get this right — mutating the live roster was sufficient.
- **A "matched" queue row (one already placed in a planning card) can't be double-booked** this way — substituting checks every planning card's slots first, mirroring the same cross-card duplicate guard used when placing a queue player into a card.
- A court's player rows are destination-only: there's no way to pull someone out with no replacement through this mechanism. That stays Void's (whole match) or End's (whole match) job.
- Instant + 5-second undo toast, not a blocking confirm (substitution is fully reversible, unlike Void) — undo restores the exact original `activeMatch` roster, removes the outgoing player's bench entry, and reinserts the incoming player into their original queue position or planning-card slot.

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

1. **Court numbering has no gap-preservation** — deleting a court always renumbers everything contiguously; there's no concept of a stable court identity independent of its display number beyond the `id` field itself.

Resolved since this file was first written, kept here only so the history isn't lost: match history now IS written (`match-log-store.ts`, real `MatchRecord`s); voided matches are correctly excluded from `gamesPlayed`; the Dashboard's queue/bench and `/players` are the same live `session-store.ts` data, not separate datasets; **automatic matchup suggestion is now wired up** — "Suggest" calls the live algorithm in `07-smart-matchup.md`, it is not a disabled stub. See `docs/specs/08-sessions.md` for the one gap this created — `MatchRecord.sessionId` exists but the Matches/Leaderboard pages aren't session-filtered yet.


---

## Player menu and editing

Every player can be edited wherever they appear: the player column, a matchup card, or a live court. They all go through one menu (`PlayerMenu.tsx`) and one edit form (the dashboard's `PlayerModal`).

**Three ways in.** Right-click with a mouse and long-press (450 ms) on touch are shortcuts. The way people actually find it is a small **⋯** button on each matchup chip and court row. It's always visible on touch screens, where there's no hover, and appears on hover with a mouse. Plain tap wasn't available: it already selects a player for swapping. After a long-press opens the menu, the tap that ends it is swallowed so it doesn't also select the player. A drag that starts mid-hold cancels the long-press. The player column rows take right-click and long-press but get no ⋯, because they already show Edit, Rest and × buttons.

**Actions depend on where the player is.**

| Where | Menu |
|---|---|
| Queue | Edit player · Rest on bench · Remove from session |
| Bench | Edit player · Back to queue · Remove from session |
| Matchup card | Edit player · Take out of card |
| Court | Edit player |

A player on court can't be removed from the menu or the form: they have to finish, be voided, or be swapped out first, or the live match would be left missing a player.

**An edit reaches every copy of the player.** During a session a player is stored as up to three separate copies: the queue or bench entry, a copy inside any matchup card holding them, and a copy inside a live court match (the queue entry is removed when a match starts). The Edit button used to update only the first, so a corrected name stayed wrong on the card and was carried onto the court. `player-edit.ts` applies the change to all of them in one save, returning inputs unchanged when a player isn't in them so a no-op edit doesn't re-render the dashboard.

**History: names everywhere, skill level forward only.** A name change also corrects every finished match in the match log (`renamePlayerInMatchLog`), because a name is identity and a typo fix should fix the Matches page too. A skill change applies to the live match and everything after it, but never to finished matches. Past upset bonuses and awards were earned against the level a player had at the time, and rewriting it would quietly change who won them.
