# Spec: Match Management

## Scope
Create, run, and close matches. Records win/loss/draw results only — no score tracking.

---

## Data Model Notes (see ARCHITECTURE.md)
- `MatchSet` model removed entirely — no score tracking
- `Match.status`: `IN_PROGRESS | COMPLETED | VOIDED` (no PENDING — match starts on creation)
- `Match.result`: `SIDE_A | SIDE_B | DRAW` — set on end; null while in progress or voided
- `Match.isWalkover Boolean` — walkover wins count for the winning side only; losing side takes no loss
- `Match.startedAt` defaults to `now()` at creation

---

## Pages & Components

### `/matches` — Match Log (built; `MatchesView.tsx`)

Session-scoped, reverse-chronological, grouped by hour. Matches are created on the Dashboard, not here — `/matches/new` and `/matches/[id]` below are **specced but unbuilt**, and there is no "New Match" button on this page.

**Each row is a fixture line with the result marked on the winner**: `✓ Bogs · Mel  vs  Karl · Ez`. A verb (`beat`) was built first and reverted — a session is overwhelmingly decisive matches, so the word was identical on every row: constant text in the most central slot, carrying no information while costing the familiar fixture-list reading. A mark on the winning side varies by position instead, which is what makes it scannable. The losing side dims rather than the winner filling — the same asymmetry at a fraction of the ink, which is what lets it survive forty rows. Draws carry an explicit badge, since an unmarked row is a poor way to state a fact. Rows also carry time, match type, **duration** (`endedAt − startedAt`, previously never displayed), a `SkillBadge` per player at `sm:`+, and an upset chip.

**Court is not displayed.** Every court is identical and auto-numbered, so it cannot inform anything about a match. `courtName` remains on the record and in the Excel export.

**A match is "long" relative to this session** — ≥1.5× the median duration, floored at 10 minutes, and null (nothing is long) under three timed matches. A constant would fire on every match some nights and none on others. The threshold is always computed from the **whole session**, never the filtered set: derived from the filtered set, activating the Long filter would recompute the median from long matches only and immediately re-exclude the shorter half of them.

**Upsets** use `matchUpset`, exported from `leaderboard.ts` so the Matches page and the Leaderboard share one definition. It reuses the bonus's `difficulty` term and omits `carry`, which describes a player's position within their own pair and has no match-level meaning.

**Search resolves to a person, not a substring.** Rows filter to that player's matches and every framed result hangs off that one identity, so searching "kar" shows Karl's night rather than a mix of Karl's and Karina's.

**Filter bar**: search, then result filters (All / Wins / Losses / Draws / Voided), then highlight toggles (Upsets / Long) after a divider. **Wins and Losses are disabled without a search** — they previously fell through to `result === "SIDE_A"` and `"SIDE_B"`, and since Side A is merely whichever side was written first, those pills split the same matches into two meaningless halves. Clearing the search resets an active Wins/Losses filter rather than leaving it framed against nobody.

**Session recap band** above the list, in two modes sharing one slot: *what happened* (matches, court time, longest match and who won it, upsets) by default, and *how their night went* (record, time on court, streak, best win) once a player is searched. It always describes the currently-visible set, and deliberately carries no points or ranking — those belong to the Leaderboard, and two surfaces computing a standing are two that can disagree.

**Void / Restore** is a soft delete: a voided row keeps a persistent Restore action indefinitely, not just for the undo-toast window, and `previousResult` preserves the original outcome so Restore brings back the real result. Batch select mode voids many at once; Escape steps back one level (confirm → selecting → default).

### `/matches/new` — Create Match (single-screen form)
**Step 1 — Players:**
- Match type toggle: Singles / Doubles
- Side A player picker (1 for Singles, 2 for Doubles)
- Side B player picker (same)
- Same player cannot appear on both sides
- Players already in an `IN_PROGRESS` match are greyed out and unselectable

**Step 2 — Court:**
- Only `AVAILABLE` courts shown
- Court is shown as a numbered list: "Court 1", "Court 2", etc.
- Pre-selects court if `?court=id` query param is present (from Court card "Start Match" CTA)

**Confirm** → calls `createMatch()` — match is created as `IN_PROGRESS`, court set to `IN_USE` immediately.

### `/matches/[id]` — Match Detail
- Header: court name, match type, Side A vs Side B players, status badge, elapsed time (live timer from `startedAt`)
- **"End Match"** button → opens `EndMatchDialog`
- **"Void Match"** button (destructive, requires confirmation) → calls `voidMatch()`
- Completed match: shows result badge (Side A Won / Side B Won / Draw), walkover tag if applicable, duration

### `EndMatchDialog`
- Result selector: "Side A Wins" / "Draw" / "Side B Wins"
- Walkover toggle: "This was a walkover" — when on, adds `isWalkover=true`
- Confirm → calls `endMatch()`

### Components
- `PlayerPicker` — searchable dropdown, active players only; greys out players in active matches
- `MatchStatusBadge` — blue=In Progress, green=Completed, red=Voided
- `MatchResultBadge` — "Side A Won", "Side B Won", "Draw"; appends "(Walkover)" if `isWalkover`
- `MatchTimer` — live elapsed time since `startedAt`, updates every minute

---

## Server Actions (`src/server/actions/matches.ts`)

```typescript
createMatch(data: {
  courtId: string
  matchType: MatchType
  sideA: string[]   // player IDs
  sideB: string[]
}): Promise<Match>
// auto-links to the current open Session (error if no session is open)
// creates match with status=IN_PROGRESS, startedAt=now(), sets court to IN_USE
// snapshots courtName from the Court record at creation time

endMatch(matchId: string, data: {
  result: MatchResult   // SIDE_A | SIDE_B | DRAW
  isWalkover?: boolean
}): Promise<Match>
// sets status=COMPLETED, endedAt=now(), court to AVAILABLE
// walkover: winning side gets +win; losing side gets no change (handled at leaderboard query time)

voidMatch(matchId: string): Promise<Match>
// sets status=VOIDED, result=null, court to AVAILABLE if it was IN_USE

getMatch(matchId: string): Promise<MatchDetail>

getMatches(filter?: {
  status?: MatchStatus
  matchType?: MatchType
  from?: Date
  to?: Date
}): Promise<Match[]>
```

---

## Leaderboard Implications
- `COMPLETED`: both sides get a win, loss, or draw counted. A draw is worth 1 point and half a win in Form — see `04-leaderboard.md` for the full points model, which replaced the old Wilson-based rating.
- `COMPLETED`, walkover: winning side would get +win only, losing side unchanged — **`isWalkover` does not exist in `src/`** (no field on `MatchRecord`, no recording UI). When it ships, the ranking has to be revisited: a walkover would otherwise inflate the winner's Points and deflate the loser's Form.
- `VOIDED`: excluded from all stats, on both the Leaderboard and the Matches recap.

---

## Validation (Zod)

```typescript
const CreateMatchSchema = z.object({
  courtId: z.string().cuid(),
  matchType: z.enum(['SINGLES', 'DOUBLES']),
  sideA: z.array(z.string().cuid()).min(1).max(2),
  sideB: z.array(z.string().cuid()).min(1).max(2),
})
.refine(data => {
  const required = data.matchType === 'SINGLES' ? 1 : 2
  return data.sideA.length === required && data.sideB.length === required
}, { message: 'Player count must match match type' })
.refine(data => {
  const all = [...data.sideA, ...data.sideB]
  return new Set(all).size === all.length
}, { message: 'Same player cannot be on both sides' })

const EndMatchSchema = z.object({
  result: z.enum(['SIDE_A', 'SIDE_B', 'DRAW']),
  isWalkover: z.boolean().optional().default(false),
})
```

---

## Edge Cases
- **Court becomes In Use before form is submitted**: show error on court selection step, prompt to pick another
- **Player enters an active match before creation is confirmed**: block on server-side check in `createMatch`
- **Voiding a completed match**: allowed; leaderboard recalculates at next query
- **Walkover as a draw**: blocked — a draw cannot be a walkover (walkover requires a declared winner)
- **No open session when creating a match**: block with prompt — "Start a session before recording matches"
- **All courts In Use when creating a match**: court step shows empty state — "No courts available. End an active match first."
- **Ending a match on a deleted court**: `courtId` is null, `courtName` snapshot still displayed; `endMatch` proceeds normally
