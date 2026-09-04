# Spec: Player Management

## Scope
The `/players` page is not a persistent roster — it's a per-session view, scoped by the same `SessionSelect` combobox and `useSessionOptions()` hook `/matches` and `/leaderboard` use, staying in sync with whichever session is selected on any of the three pages. Viewing the **open** session shows a live view of whoever is currently in its queue or bench (`useQueueSnapshot`/`useBenchSnapshot` from `src/lib/session-store.ts`), the same localStorage-backed store the live Dashboard reads and writes, fully editable exactly as before. Viewing a **closed** session instead shows that session's frozen `SessionPlayerSnapshot[]` (captured once at close time via `useSessionArchive()`) — read-only, since a snapshot has no live queue/bench entry behind it to mutate: no edit drawer, no payment toggle (a plain `StatusBadge` read-out instead), no Queued/Benched state (not preserved — `closeSession` merges queue+bench without remembering which). Check-in time *does* survive, though — `SessionPlayerSnapshot.sessionJoinedAt` is captured at close time, so you can still see what time someone arrived after their session has ended (snapshots taken before this field existed just show "—"). There is no standalone player directory outside any session. **There is currently no backend** — `session-store.ts` persists to `localStorage` only.

Both `/players` and the Dashboard's `AddPlayersModal` write into the same queue, so a player added or edited from either surface is immediately visible on the other — there are no longer two disconnected player pools.

---

## Roster overview

A bento dashboard above the table (`RosterOverview.tsx`, stats in `src/lib/player-stats.ts`, covered by `player-stats.test.ts`).

**There are no demographics in the data model** — no age, no location, no tenure — and no cross-session history to aggregate. The overview measures **composition and fairness** instead:

| Cell | Shows | Source |
|---|---|---|
| Session | Headcount and completed matches, plus anyone missing a gender | roster, match log |
| Collected | Settled / total, with a paid-vs-waived bar and what's still owed | `paymentStatus` |
| Make-up | Skill mix and gender split, stacked — **both filter the table** | `skillLevel`, `gender` |
| Rotation | Games-played histogram, a plain-language verdict, and the names of anyone behind | derived |
| Average wait | Mean queue time now, plus a histogram of waits by minute and a flow verdict | `enteredQueueAt` |
| Waiting longest | The longest current wait, with the next three beneath | `enteredQueueAt` |
| Wait across the evening | Average queue wait plotted against clock time | sampled, `wait-trend.ts` |

**Rotation is the one with a person behind it.** The queue exists to stop anyone sitting out and nothing has ever reported whether it worked. A player is flagged when they are `LAGGARD_GAP` (2) or more matches below the median — raw spread over-flags, since a late arrival always trails and that isn't the rotation failing. Below four players no verdict is given at all: the median is describing noise, not a field.

**The wait distribution is a step line.** Fixed five-minute buckets with an open-ended `20+`, x = minutes waited, y = players. A *stairs* plot rather than a polyline through bucket midpoints: counts are binned, so there is no "2.5 players at 7.5 minutes" to interpolate, and a step holds each value flat across its own bucket while asserting nothing in between. It is also the only honest way to draw the open-ended `20+` bin, which has no centre for a line to pass through. Not a box plot either: a queue holds a handful of people, so quartiles would be describing noise while asking more reading literacy than the job needs — and a box plot beside the rotation histogram would be two visual languages for one idea. Buckets are fixed rather than derived because the chart updates every second, and axis labels that reshuffle under the reader are unreadable; fixed edges also make two sessions comparable.

**"Too long" is one median match, not a constant.** A wait exceeding how long a match actually takes means that player sat through a full rotation cycle without being picked. Twelve minutes is fine where matches run 25 and bad where they run 8, so a fixed number can't answer the question — the threshold comes from `matchDurationMs` over the session's completed matches, falling back to `DEFAULT_LONG_WAIT_MS` (15m) before enough have finished to tell. Bars are flagged by whether they actually contain a stuck player rather than by whether their bounds straddle the line, so a threshold landing mid-bucket doesn't paint the whole bar late on behalf of someone who isn't.

**The evening trend is a real line chart, and the only one here that should be.** Clock time is continuous, so the space between two samples genuinely means something — this is what shows waits creeping up after a court was lost, or settling once the queue thinned, which no snapshot can.

It needs data the app never recorded, so `wait-trend.ts` samples the live queue's average wait once a minute into `localStorage`, keyed by session. **`WaitTrendRecorder` is mounted in `AppShell`, not on `/players`** — that page is not where a session is spent, and recording only while it was open would leave holes exactly when the queue was busiest. `appendSampleTo` refuses a sample taken within 55s of the last, which is what makes the recorder safe to mount more than once; `pruneStore` drops trends for sessions the app has forgotten and caps retention at 8 sessions and 480 samples each, so the store can't leak across months of play.

**Its honest limit:** it only covers time the app was actually open. There is no background execution, and the caption says as much rather than implying a continuous record.

**The two waiting cells appear only on the open session.** `enteredQueueAt` lives on a live `QueueEntry` alone — `BenchEntry` doesn't carry it and `closeSession` never writes it into `SessionPlayerSnapshot` — so a closed session has no waiting data preserved anywhere. The cells are absent rather than showing a zero the data never contained.

Two exclusions, both structural. **Benched players don't count**: they opted out of the queue, so counting them would inflate the average with people who aren't asking for a game and could point the longest-wait callout at someone who doesn't want to be called. **Players on court don't count**: their `enteredQueueAt` is a stale timestamp from before they were pulled, so including them would report a wait that already ended. Times run off the shared `useTick` clock, so they update alongside every other `ElapsedTimer` instead of starting an interval of their own.

**Segments drive the page's existing filters.** The unspecified-gender slice renders but is never clickable — there is no "no gender" filter behind it, and a segment that looks interactive and isn't is worse than one that plainly isn't. Stats always come from the unfiltered roster, or each chart would describe its own selection.

**The roster table sits in a card** matching the bento cells, with a live **Waiting** column (open sessions only — a player on court or benched reads "—", not a stale figure), and **Games played as a number plus a proportional rule** against the busiest player, tinted `warning` for anyone the rotation left behind. Check-in and Notes hide below `xl:` so the interactive Payment toggle isn't squeezed; the mobile cards keep every field.

The card uses `overflow-clip` and must never be switched to `overflow-hidden`: both clip the sticky header's square corners to the rounded border, but `hidden` also makes the card a scroll container, which stops the header pinning to the viewport.

---

## Data Model (current, from `src/types/index.ts`)

```typescript
type SkillLevel = "F" | "E" | "D" | "C" | "B" | "A" | "S"; // low to high
type Gender = "M" | "F";
type PaymentStatus = "PAID" | "UNPAID" | "WAIVED";

interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes?: string;           // organizer-only, private
  paymentStatus: PaymentStatus; // manual ledger, this session only; defaults to UNPAID
}

interface QueueEntry {
  id: string;
  position: number;
  player: Player;
  isInMatch: boolean;
  sessionJoinedAt: string;  // set once; never reset on re-queue — drives FIFO order
  enteredQueueAt: string;   // reset on every (re-)entry — drives "waiting time" display
}

interface BenchEntry {
  id: string;
  player: Player;
  sessionJoinedAt: string;
}
```

There is no `PlayerStatus` / active-inactive concept. Presence in the queue or bench *is* the status: a player not in either is simply not part of the session, and doesn't appear on `/players`. `docs/ARCHITECTURE.md`'s Prisma schema still models `Player` as a persistent, cross-session entity with a `status` field for soft-delete — that target schema has not been revisited in light of this decision (see note at the end of this file).

**Known limitation**: a player currently mid-match on a court isn't reflected on `/players`. Court/active-match state (`courts` in `DashboardClient.tsx`) is local component state, not yet extracted into a shared, persisted store the way queue/bench are — so it can't currently be read from another page. A player disappears from `/players` while playing and reappears when they return to the queue.

---

## Pages & Components

### `/players` — Session Roster (`PlayersView.tsx`)
Search + filter + sort + edit + remove, scoped to whichever session is selected via the title-bar `SessionSelect` (synced with `/matches` and `/leaderboard`). No create entry point on this page — see `AddPlayersModal` on the Dashboard.

**Table columns** (responsive column hiding by breakpoint):

| Column | Always visible? | Sortable | Closed session |
|---|---|---|---|
| Name | Yes | Yes | as recorded |
| Skill (badge) | Yes | Yes | as recorded |
| Payment | Hidden < `sm` | Yes | read-only `StatusBadge`, not the toggle |
| Gender (icon or —) | Hidden < `sm` | Yes | as recorded |
| State (dot + "Queued"/"Benched") | Hidden < `sm` | Yes | — (not preserved in the snapshot) |
| Games (session-scoped match count) | Hidden < `md` | Yes | as recorded |
| Check-in (formatted `sessionJoinedAt`) | Hidden < `lg` | Yes | as recorded, or — if the snapshot predates this field |
| Notes (truncated or —) | Hidden < `lg` | No | as recorded |

Default sort: Name ascending. Clicking a sortable header toggles direction. Sorting by Payment ranks Unpaid first, then Waived, then Paid — surfaces who still owes. Games is scoped to the selected session (not all-time).

**Payment column**: for the **open session**, `PaymentToggle.tsx` — a tap-to-set 3-segment inline control, no drawer needed — clicking a segment calls `updateQueuePlayer`/`updateBenchPlayer` directly with the new `paymentStatus`, exactly like any other field edit. New players default to `UNPAID`. For a **closed session**, a plain `StatusBadge` read-out instead — a closed session's players are a frozen `SessionPlayerSnapshot[]`, not a live queue/bench entry, so there's nothing to mutate. The header shows a running `{n} paid` count next to the row total, computed over the currently filtered rows, for whichever session is selected. **Deliberately out of scope for now** (real PRD stories, not yet built): session fee amounts, per-payment overrides, payment notes, an Unpaid-only filter, and editing a closed session's frozen payment record after the fact.

**Filters**:
- Free-text search (name substring, case-insensitive)
- Skill filter: multi-select chips (S/A/B/C/D/E/F)
- Gender filter: multi-select chips (M/F)
- "Clear" link resets search + skill + gender filters

**Row interaction**: for the **open session**, the entire row is clickable (mouse or keyboard) and opens `PlayerModal` in edit mode, exactly as before. For a **closed session**, rows are plain read-outs — no click handler, no modal, matching `SessionDetailView`'s existing read-only player table for the same reason (frozen snapshot, nothing to edit).

### `PlayerModal.tsx` — single-player edit/remove
Centered modal dialog (matches `AddPlayersModal`'s chrome — backdrop, `max-w-md`, scale/opacity transition, padded at every breakpoint), edit mode only (`editingPlayer: Player | null`) — opens from a `/players` row when the open session is selected, and from the Dashboard's Player Pool via a row-level Edit action. Previously a right-side sliding drawer; converted to a modal for visual consistency with `AddPlayersModal` (the app's other player-data-entry surface) and because a right-docked panel risked visually colliding with the Dashboard's Courts column once this component started mounting there too.

Fields: Name (required, min 2 characters), Skill Level (`SkillLevelSelect`, shared component — see below), Gender (`GenderToggle`, `variant="full"`, optional, click-to-deselect), Notes (textarea, organizer-only). A **"Remove from session"** action pulls the entry out of whichever store (queue or bench) it's in; `PlayersView` shows a 5-second undo toast (`restoreQueueEntry`/`restoreBenchEntry`), matching the toast/undo convention used on the Dashboard and Matches page.

Standard dialog behaviors: discard-confirmation when closing with unsaved changes, Escape/focus-trap, a simulated 300ms save delay before committing (no real async work — see Known Gaps).

**Skill-level history is not implemented.** The modal shows the copy "Changing skill level creates a history entry" when editing a player's skill level — this is currently misleading UI text; no history record of any kind is created anywhere in the codebase. A real backend should either implement the write path this copy implies, or the copy should be removed until it does.

### Dashboard add-players (`AddPlayersModal.tsx`, opened from `PlayerPoolColumn.tsx`'s "Add" button)
The Dashboard's own player-creation entry point, writing into the same session queue `/players` reads from `session-store.ts`.

**One screen, no wizard.** This was previously a two-step flow — paste every name into a textarea, then review a grid and set each player's level and gender. The split was the problem: an organizer typing twelve names transitioned away and was shown twelve blank gender toggles with no memory of who was who. Bulk entry isn't the hard part; *batching the detail entry away from the names* is. So the paste step and the review step are now the same surface.

**Quick-add is the whole flow for one player.** A single line at the top — name input, `SkillLevelSelect`, `GenderToggle`, and an Add button. One player costs `type → Enter → Add`; it used to cost `type → Continue → set level → set gender → Add`.

**Enter commits from anywhere in that row**, then returns focus to the name field — not just from the name input. Handled in the capture phase, because two children claim Enter and would otherwise win: a `GenderToggle` pill is a `<button>`, so Enter fires its click and toggles the gender you just picked back *off*; `SkillLevelSelect`'s trigger opens its dropdown. Intercepting on the way down suppresses both.
- The dropdown keeps Enter while it is genuinely open, where it means "choose this level". Space and the arrow keys still open it, so nothing becomes unreachable by keyboard.
- Enter on a gender pill reads as "this one, and add" — the pill's gender is applied even if it wasn't the selected one, which saves a keystroke, and it carries forward as the sticky default like any other choice. `GenderToggle` exposes `data-gender` on each pill so the container can read that without parsing label text.
- With an empty name there is nothing to commit, so the keystroke is left to whichever control has focus rather than being swallowed for a no-op.

- **Sticky defaults are the engine.** Level and gender persist across commits, so the next row inherits what the last player used. Players check in as clusters (three intermediate men arrive together), which makes "same as the one before" right far more often than any fixed default, and reduces a run of similar players to *name, Enter, name, Enter*. Level starts at Intermediate; gender starts unset.
- **Paste still works, and lands as incomplete rows.** A paste containing a newline is intercepted and split into staged rows (newline-only, so "Smith, John" stays one player). It cannot complete anyone — none of them have a gender — so it stages them honestly rather than filling in a guess.

**Staged rows sit directly below: one row shape, in the order they were added.** Every row carries the same persistent controls — name, `SkillLevelSelect`, `GenderToggle`, remove — whether or not it's complete.

- This replaced a two-shape split: a form row for anyone missing a gender under a "Needs a gender" heading, and a compact `SkillBadge` + `GenderIcon` read-back with an Edit button under "Ready to add". It cost three states to hold at once (which section a row is in, which shape it has, whether it's in edit mode), and rows physically jumped between sections the moment a gender was set. A row missing a gender now shows it plainly — neither pill is lit — which is the only thing the split was actually communicating.
- **The name is a borderless input** that draws its edge only on hover and focus. It reads as text, so a stack of them stays calm rather than looking like a six-field form, while staying directly editable with no Edit button and no mode to enter.
- **Rows are divided by hairlines, not boxed as cards.** Six bordered cards each containing three bordered controls was the bulk of the visual noise.
- **A persistent "Set all" bar** sits above the list whenever 2+ rows are staged, sticky to the top of the scroll area so a long list can be re-swept without scrolling back. It applies a level or a gender to **every** staged row and stays available for as long as rows are staged. Its controls sit in the same columns as each row's (a spacer holds the remove column), so it reads as the same pair of controls aimed at everyone at once.
  - It previously swept only the incomplete rows, which made it effectively one-shot: setting a gender for all graduated every row to "ready" and left the control with nothing to reach, so a mis-tap could only be undone by editing each row by hand — the exact work it exists to avoid. A sweep you can't re-aim isn't a bulk edit.
  - Overwriting a hand-edited row is the accepted cost; every sweep snapshots the prior rows and offers undo. Level and gender sweep independently, so re-aiming gender never disturbs levels.
  - The controls display the rows' *shared* value rather than the last one applied — "everyone is Male", not a memory the rows may have diverged from. `GenderToggle` shows nothing selected for a mixed set; `SkillLevelSelect` needs a concrete level, so it falls back to the last swept one when mixed.
  - Tapping the already-active gender pill is a no-op rather than `GenderToggle`'s usual deselect, which here would strip the gender from every row at once.
  - The bar carries the only remaining progress signal: a muted "N still need a gender" line, shown only when that count is non-zero.
- **Duplicate names are flagged live** — against both the existing session roster and other rows in the same batch (both colliding rows are marked, not just the second), and the quick-add input itself flags a duplicate before you commit it. Comparison is case-sensitive on purpose: "Alex" and "alex" are different people, not a normalisation problem to solve. Submission is blocked until resolved.
- **Missing gender is gated behind a submit attempt.** Rows begin without one, so validating live would ring every pasted row red the instant it lands. On a failed submit the first offending row is scrolled into view and its toggle focused.
- **An uncommitted quick-add draft is included on submit.** Typing a name and pressing the submit button without pressing Enter first adds that player rather than silently dropping them — the worst possible failure on this surface.
- **Row removal** shows a toast with undo, restoring the row at its original index.
- Submit is re-entrancy guarded by a ref, not just `disabled` — a fast double-tap on a tablet can beat React's re-render and submit the batch twice.
- Closing with anything staged (or a draft name typed) raises the discard confirmation.

On submit, each row becomes a new `QueueEntry` with a client-generated player id (`p-{timestamp}-{i}`) and a `sessionJoinedAt`/`enteredQueueAt` staggered by `i` milliseconds so multiple players added in the same batch preserve their order when the FIFO queue later sorts by check-in time (see `05-queue-matchup.md`). These are immediately visible on `/players`.

### Shared form controls (`src/components/ui/`)
- **`SkillLevelSelect`** — a custom combobox (not a native `<select>`), showing the selected `SkillBadge` plus the full skill label ("Intermediate", "Advanced", etc.) with a portaled dropdown list. Used by both `PlayerModal` and `AddPlayersModal` so the two entry points stay visually and behaviorally identical.
- **`GenderToggle`** — a two-button (M/F) toggle-radio group, click-again-to-deselect. `variant="full"` renders full words in a 2-column grid (`PlayerModal`); `variant="compact"` renders bare letters in a single-line pair (`AddPlayersModal`'s quick-add line and staged rows, where horizontal space is tight).
- **`PaymentToggle`** — a three-button (Paid/Unpaid/Waived) toggle-radio group rendered directly in the `/players` table row (not in `PlayerModal`). Single tap sets the exact state; no cycling.

---

## Validation

- **`PlayerModal`**: name required, minimum 2 characters after trim.
- **`AddPlayersModal`**: name required (non-empty after trim) — no minimum length enforced, an inconsistency with `PlayerModal`'s stricter rule for the same underlying field.
- **Duplicate-name detection exists only in `AddPlayersModal`**, which blocks submission against both the current roster and the batch itself. `PlayerModal` and `PlayersView`'s save logic have none: renaming an existing player onto another player's name still goes through without warning.

---

## Known Gaps (for backend implementation)

Places where the UI implies behavior that has no real implementation behind it — a backend build should either implement the real thing or the UI copy should be revisited:

1. **No persistence beyond localStorage.** Every "save" writes to `localStorage`; nothing survives a cleared browser or a different device.
2. **No cross-session player history *across* sessions, though a single past session is now viewable.** `/players` can show a closed session's frozen roster (name, skill, gender, payment, notes) via `SessionSelect`, but there's still no way to look up a specific person's history across every session they've played, and no quick "re-add a regular" flow into a new session — every new session starts from zero. If the real product wants a persistent club roster, that's a reversal of this decision, not an extension of it.
3. **Skill-level history is UI-only copy with no data behind it.** No history record is ever created on a skill-level change.
4. **Duplicate-name detection is add-time only.** `AddPlayersModal` blocks it, but editing a player's name on `/players` can still produce a collision, despite name being the only required, user-typed identifier.
5. **In-match players are invisible on `/players`.** See the "Known limitation" note above — court state isn't in a shared store yet.
6. **Validation is inconsistent between `PlayerModal` and the Dashboard bulk-add** (2-character minimum in the modal, none in `AddPlayersModal`) — `/players` itself has no creation entry point, only edit, so this surfaces only via the modal opened from a row.

---

**Open item, not resolved by this doc**: `docs/ARCHITECTURE.md`'s target Prisma schema still models `Player` as a persistent entity with a `status` soft-delete field, aimed at a future backend. This spec now documents the opposite decision for the frontend (no persistent player identity across sessions). Reconciling which one the real backend should follow is a product decision, not a documentation fix — flag to the organizer before building the backend `Player` table.
