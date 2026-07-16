# Spec: Player Management

## Scope
The `/players` page is not a persistent roster — it's a per-session view, scoped by the same `SessionSelect` combobox and `useSessionOptions()` hook `/matches` and `/leaderboard` use, staying in sync with whichever session is selected on any of the three pages. Viewing the **open** session shows a live view of whoever is currently in its queue or bench (`useQueueSnapshot`/`useBenchSnapshot` from `src/lib/session-store.ts`), the same localStorage-backed store the live Dashboard reads and writes, fully editable exactly as before. Viewing a **closed** session instead shows that session's frozen `SessionPlayerSnapshot[]` (captured once at close time via `useSessionArchive()`) — read-only, since a snapshot has no live queue/bench entry behind it to mutate: no edit drawer, no payment toggle (a plain `StatusBadge` read-out instead), no Queued/Benched state (not preserved — `closeSession` merges queue+bench without remembering which). Check-in time *does* survive, though — `SessionPlayerSnapshot.sessionJoinedAt` is captured at close time, so you can still see what time someone arrived after their session has ended (snapshots taken before this field existed just show "—"). There is no standalone player directory outside any session. **There is currently no backend** — `session-store.ts` persists to `localStorage` only.

Both `/players` and the Dashboard's `AddPlayersModal` write into the same queue, so a player added or edited from either surface is immediately visible on the other — there are no longer two disconnected player pools.

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

**Row interaction**: for the **open session**, the entire row is clickable (mouse or keyboard) and opens `PlayerDrawer` in edit mode, exactly as before. For a **closed session**, rows are plain read-outs — no click handler, no drawer, matching `SessionDetailView`'s existing read-only player table for the same reason (frozen snapshot, nothing to edit).

### `PlayerDrawer.tsx` — single-player edit/remove
Right-side drawer, edit mode only (`editingPlayer: Player | null`) — opens from a `/players` row when the open session is selected.

Fields: Name (required, min 2 characters), Skill Level (`SkillLevelSelect`, shared component — see below), Gender (`GenderToggle`, `variant="full"`, optional, click-to-deselect), Notes (textarea, organizer-only). A **"Remove from session"** action pulls the entry out of whichever store (queue or bench) it's in; `PlayersView` shows a 5-second undo toast (`restoreQueueEntry`/`restoreBenchEntry`), matching the toast/undo convention used on the Dashboard and Matches page.

Standard dialog behaviors: discard-confirmation when closing with unsaved changes, Escape/focus-trap, a simulated 300ms save delay before committing (no real async work — see Known Gaps).

**Skill-level history is not implemented.** The drawer shows the copy "Changing skill level creates a history entry" when editing a player's skill level — this is currently misleading UI text; no history record of any kind is created anywhere in the codebase. A real backend should either implement the write path this copy implies, or the copy should be removed until it does.

### Dashboard bulk-add (`AddPlayersModal.tsx`, opened from `PlayerPoolColumn.tsx`'s "Add" button)
The Dashboard's own multi-player creation entry point, writing into the same session queue `/players` reads from `session-store.ts`.

Repeatable-row form: each row is Name (required) + Skill Level (`SkillLevelSelect`) + Gender (`GenderToggle`, `variant="compact"`, optional). Supports:
- **Multiple rows** via "+ Add another player" — newly added rows auto-focus their name field.
- **Enter-to-advance**: pressing Enter in a name field moves to the next row's name field, or creates and focuses a new row if on the last one.
- **Paste-splitting**: pasting multi-line text into a name field splits it into one row per non-empty line, inserted immediately after the current row.
- **Row removal with undo**: removing a row with a non-empty name shows a 6-second inline "Removed 'X' · Undo" affordance before it's gone for good; empty rows delete with no undo prompt.
- **Partial-row transparency**: blank rows are silently excluded from submission, but the UI states this explicitly (an inline per-row caption plus a footer count like "4 of 6 rows will be added") instead of surfacing it only after the fact.
- Submit button label is dynamic ("Add Player" / "Add N Players").

On submit, each valid row becomes a new `QueueEntry` with a client-generated player id (`p-{timestamp}-{i}`) and a `sessionJoinedAt`/`enteredQueueAt` staggered by `i` milliseconds so multiple players typed in the same batch preserve their row order when the FIFO queue later sorts by check-in time (see `05-queue-matchup.md`). These are immediately visible on `/players`.

### Shared form controls (`src/components/ui/`)
- **`SkillLevelSelect`** — a custom combobox (not a native `<select>`), showing the selected `SkillBadge` plus the full skill label ("Intermediate", "Advanced", etc.) with a portaled dropdown list. Used by both `PlayerDrawer` and `AddPlayersModal` so the two entry points stay visually and behaviorally identical.
- **`GenderToggle`** — a two-button (M/F) toggle-radio group, click-again-to-deselect. `variant="full"` renders full words in a 2-column grid (`PlayerDrawer`); `variant="compact"` renders bare letters in a single-line pair (`AddPlayersModal`'s repeatable rows, where horizontal space is tight).
- **`PaymentToggle`** — a three-button (Paid/Unpaid/Waived) toggle-radio group rendered directly in the `/players` table row (not in `PlayerDrawer`). Single tap sets the exact state; no cycling.

---

## Validation

- **`PlayerDrawer`**: name required, minimum 2 characters after trim.
- **`AddPlayersModal`**: name required (non-empty after trim) — no minimum length enforced, an inconsistency with `PlayerDrawer`'s stricter rule for the same underlying field.
- **No duplicate-name detection exists anywhere** — not in `PlayerDrawer`, not in `PlayersView`'s save logic, not in `AddPlayersModal`/the Dashboard's add-players handler. Two players with an identical name can be created without warning on either surface.

---

## Known Gaps (for backend implementation)

Places where the UI implies behavior that has no real implementation behind it — a backend build should either implement the real thing or the UI copy should be revisited:

1. **No persistence beyond localStorage.** Every "save" writes to `localStorage`; nothing survives a cleared browser or a different device.
2. **No cross-session player history *across* sessions, though a single past session is now viewable.** `/players` can show a closed session's frozen roster (name, skill, gender, payment, notes) via `SessionSelect`, but there's still no way to look up a specific person's history across every session they've played, and no quick "re-add a regular" flow into a new session — every new session starts from zero. If the real product wants a persistent club roster, that's a reversal of this decision, not an extension of it.
3. **Skill-level history is UI-only copy with no data behind it.** No history record is ever created on a skill-level change.
4. **No duplicate-name detection**, despite name being the only required, user-typed identifier.
5. **In-match players are invisible on `/players`.** See the "Known limitation" note above — court state isn't in a shared store yet.
6. **Validation is inconsistent between `PlayerDrawer` and the Dashboard bulk-add** (2-character minimum in the drawer, none in `AddPlayersModal`) — `/players` itself has no creation entry point, only edit, so this surfaces only via the drawer opened from a row.

---

**Open item, not resolved by this doc**: `docs/ARCHITECTURE.md`'s target Prisma schema still models `Player` as a persistent entity with a `status` soft-delete field, aimed at a future backend. This spec now documents the opposite decision for the frontend (no persistent player identity across sessions). Reconciling which one the real backend should follow is a product decision, not a documentation fix — flag to the organizer before building the backend `Player` table.
