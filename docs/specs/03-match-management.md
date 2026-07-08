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

### `/matches` — Match Log
- Filter bar: date range picker, match type (All / Singles / Doubles), status chips (All / In Progress / Completed / Voided)
- Table: Date, Court, Type, Side A Players, Side B Players, Result, End Type, Actions
- "New Match" button → `/matches/new`

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
- `COMPLETED`, non-walkover: both sides get win or loss counted
- `COMPLETED`, walkover: winning side gets +win only; losing side record unchanged
- `DRAW`: both sides get +draw; neither gets a win or loss
- `VOIDED`: excluded from all stats

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
