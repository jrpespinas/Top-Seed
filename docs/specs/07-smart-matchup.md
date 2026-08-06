# Spec: Smart Matchup Suggestion

## Scope
Algorithm-driven matchup suggestion that balances competitive fairness, game intensity, pairing variety, and gender composition. Extends the basic queue-order suggestion in `05-queue-matchup.md`.

---

## What Changed From Basic Suggestion
Basic suggestion: take the next N players in queue order.
Smart suggestion: draw a small rolling window of eligible players, score all valid arrangements within it, and return the best one.

---

## Candidate Pool

### Eligibility
A player is eligible to appear in the window if they are:
- In the **queue** for the current session (bench players are excluded)
- Not currently in an `IN_PROGRESS` match

Arrival order is determined by `sessionJoinedAt` on `QueueEntry` — the timestamp when the player first entered the session, which never resets on re-queue. This ensures players who checked in earlier retain their seniority even after returning from a match.

### The Rolling Window
Each planning card evaluates a **window of eligible players**, drawn in arrival order. The window is not a fixed slice — it's a rolling buffer that stays at a constant size across the whole planning-card sequence for a round:

1. **Card 1** opens with the earliest *N* eligible players in the queue, where *N* is the effective window size (see below).
2. It selects the best-scoring group (4 for doubles, 2 for singles) out of that window. The players **not** selected remain in the window.
3. **Card 2's** window is topped back up to *N* by pulling in exactly as many *new* players from further down the queue as were just selected out — e.g. 4 leftover + 4 fresh arrivals for doubles.
4. This repeats for every additional card/court opened in the same round: leftovers always carry forward, new arrivals only backfill the difference.

This keeps every card's decision scoped to the same constant field of *N* within a round, rather than a pool that grows with each additional court. A player who scores poorly against one window's competition isn't compared against an ever-larger field in the next round — they reappear in a same-sized window, which keeps their odds of eventually being picked from silently shrinking round over round.

**Scaling the window with the waiting queue:** *N* is not always 10. A flat window starves skill-tier variety once a session gets large enough that same-level players outnumber the window — a small pool of Advanced players can end up matched against each other every single round, even when other Advanced players are waiting just past position 10 and never become candidates. To fix that without reopening the exact problem the fixed window solved (early arrivals buried under an ever-larger field), the effective window size scales with the *total number of players currently waiting* (queue entries not mid-match, session-wide — not scoped to this card's own exclusions):

```typescript
function effectiveWindowSize(waitingCount: number): number {
  return clamp(Math.floor(waitingCount / 2), windowSize, maxWindowSize) // 10, 24
}
```

- **Sessions with under ~20 players waiting see no change at all** — the floor is today's constant (10).
- Past that, the window grows roughly half as fast as the queue: 30 waiting → window 15, 40 waiting → window 20.
- It caps at **24** once ~48+ players are waiting — a deliberate fairness ceiling, not a performance one (a window well past 24 is trivial to score client-side; the cap exists purely so early arrivals can't be diluted into an unbounded field).
- Recomputed fresh on every `suggestMatchup` call from the live queue — never cached or persisted, and needs no new plumbing from callers since the function already receives the full queue.

**Minimum thresholds:**
- Doubles needs at least 4 eligible players in the window; singles needs at least 2.
- If the queue can't fill the window to that minimum (including all remaining eligible players), Smart Suggest is disabled for that card — no button rendered.

---

## Scoring a Matchup

For a given window, every valid group of players (a group of 4 for doubles, 2 for singles) drawn from that window, and every way to split that group into two sides, is a candidate arrangement. Each is scored; the highest-scoring one is suggested — subject to two gates applied before scoring narrows the candidate set: Level Preference first, Gender Preference second, nested inside it.

### 0a. Level Preference (outer gate, applied before scoring)
"As much as possible, all players the same level" outranks everything else, including gender — a same-level mixed group is preferred over a same-gender group spanning several levels. In priority order:

1. **Exact level** — every player in the group shares one skill level. If at least one exact-level group exists in the window, only exact-level groups continue to the gender gate.
2. **Adjacent level** — the group's skill levels span at most one rank (e.g. B and A, but not B and S). Tried only if no exact-level group exists.
3. **Unrestricted** — if neither tier is possible, level is dropped for this round.

### 0b. Gender Preference (inner gate, applied within the chosen level tier)
Real badminton has same-gender and mixed-gender formats; the suggestion prefers the more specific one when the window (already filtered to the chosen level tier) supports it, in this order:

1. **Same-gender** — all 4 players (doubles) or both players (singles) share a gender. If at least one same-gender group exists, only same-gender groups are scored.
2. **Mixed Doubles convention** (doubles only) — if no same-gender group exists but the level-filtered window has at least 2 men and 2 women, only groups of exactly 2-and-2 are considered, and only splits where each side has one of each gender (true mixed doubles, not an arbitrary split). This is the deliberate last resort: mixed gender is only ever reached after level compatibility has already been settled.
3. **Unrestricted** — if neither tier is possible, gender is dropped for this round and all groups/splits (within the chosen level tier) are scored normally.

Players with `gender` unset act as wildcards: they don't block a same-gender or mixed-doubles arrangement, and they aren't the reason one gets chosen either — they're simply excluded from the gender check itself. Between the two gates, up to 9 (level × gender) tier combinations are attempted in priority order before falling back to fully unrestricted.

### 1. Balance Score (weight: 60%)
Measures how evenly matched the two sides are using skill level only. Win rate no longer feeds this score directly — it only breaks ties, see the Win-Rate Balance tiebreak below.

```typescript
function avgSkill(players: Player[]): number {
  const skillRank = { S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7 }
  // normalize to 0–1 where 1 = strongest
  return mean(players.map(p => (8 - skillRank[p.skillLevel]) / 7))
}

function balanceScore(sideA: Player[], sideB: Player[]): number {
  const diff = Math.abs(avgSkill(sideA) - avgSkill(sideB))
  return 1 - diff  // 1 = perfectly balanced
}
```

### 2. Challenge Preference (tiebreak, 1st stage)
Balanced sides are usually competitive, but balance alone doesn't guarantee a player faces real opposition — two weak players paired together can look "balanced" against another weak pair without pushing anyone. When multiple arrangements land within a small margin of each other on Balance Score, prefer the one that gives the most players an opponent at or above their own skill level, rather than the one that gives anyone an easy win. This only breaks near-ties; it never overrides a clearly better Balance Score, and it never forces a pairing the window can't support — if every option in the window pairs someone down, that's simply the best available game this round.

### 2b. Win-Rate Balance (tiebreak, 2nd stage)
If arrangements are still tied after Challenge, prefer the one where the two sides' current-session win rates are closest — the same balancing idea Balance Score applies to skill, now applied to win rate as a secondary consideration rather than folded into the main score.

```typescript
function winRateBalance(sideA: Player[], sideB: Player[], sessionId: string): number {
  const avgA = mean(sideA.map(p => getSessionWinRate(p.id, sessionId)))
  const avgB = mean(sideB.map(p => getSessionWinRate(p.id, sessionId)))
  return 1 - Math.abs(avgA - avgB)
}
```

`getSessionWinRate(playerId, sessionId)`: wins ÷ matchesPlayed within this session. Returns 0.5 (neutral) if the player has no matches yet this session — defaulting to neutral avoids penalising new players.

### 3. Novelty Score (weight: 40%)
Penalises recently repeated pairings within the current session.

- **Doubles**: A "pair" is two players on the same side
- **Singles**: A "pair" is two players facing each other

```typescript
function noveltyScore(sideA: Player[], sideB: Player[], sessionId: string): number {
  const pairs = matchType === 'DOUBLES'
    ? [[sideA[0].id, sideA[1].id], [sideB[0].id, sideB[1].id]]
    : [[sideA[0].id, sideB[0].id]]

  const counts = pairs.map(([a, b]) => countSessionPairings(a, b, sessionId))
  const avg = mean(counts)
  return avg === 0 ? 1 : 1 / (1 + avg)  // 1 = never paired this session
}
```

`countSessionPairings(playerA, playerB, sessionId)`: how many times these two players appeared on the same side (doubles) or in the same match (singles) within the current session.

### Final Score
```typescript
const finalScore = 0.6 * balanceScore + 0.4 * noveltyScore
// Tiebreak order among near-equal finalScores, after the Level and Gender
// gates have already narrowed the candidate set:
//   1. Challenge Preference (most players facing a same-or-above opponent)
//   2. Win-Rate Balance (closest session win rates between the two sides)
//   3. Arbitrary (first arrangement enumerated)
```

---

## Fairness Safeguards: Skip Cap and First-Game Priority

Because scoring can legitimately pass over a player in the window in favor of a better-scoring group, the system tracks how many consecutive times each player has been present in a window but not selected into the winning arrangement — and separately fast-tracks anyone who hasn't played yet this session.

**Skip cap:**
- Each time a suggestion runs and a player is in the window but not chosen, their skip count increments.
- Each time a player is chosen, their skip count resets to 0.
- Skip counts are session-scoped — they don't carry over between sessions.
- If a player's skip count reaches the cap (default: **2**), they become force-include eligible.

**First-game priority:**
- A player with 0 completed matches this session is also force-include eligible, regardless of skip count.
- This is deliberately **not persisted** past a player's first game — there's no ongoing "total games fairness" mechanism. Early arrivals naturally accumulate more total games than late arrivals simply by having more session time; the goal is only to make sure a latecomer isn't stuck waiting behind repeated re-shuffles before their very first game.

**Combined force-include:** the next time a player who qualifies under either rule appears in a window, they are **force-included** in the selected group regardless of score — zero-games players take priority over skip-capped players when both compete for the same limited slots. The remaining slots and side-split are still chosen to score as well as possible around the forced inclusion(s), and force-inclusion still respects whichever level/gender tier is active — a forced player is seated within a tier the window actually supports, never into one it doesn't.

This is a backstop, not the common case — with a window of at least 10 (more in larger sessions), most players are picked well before hitting the skip cap, and most players get their first game within the first round or two. It exists for the rare outlier (an unusual skill level, the only player of a given gender, or someone who just checked in) who could otherwise be repeatedly out-scored or left waiting round after round.

---

## Repeat Pair Exhaustion

When every possible arrangement available in the current window (after the gender gate) has already been played this session:
- Falls back to the least-recently-paired arrangement among them
- UI shows a subtle note: "All unique pairs used — suggesting least recently repeated"

With a window of 10+ (scaling higher in larger sessions, see above) this is now a much rarer fallback than under a fixed 4-player pool, since the number of valid arrangements is far larger — but it can still happen in a small or long-running session.

---

## Multi-Court Handling

When multiple planning cards are open at once (multiple courts to fill in the same round):
- Card 1 draws the first window (sized per the effective-window formula above) and selects its group.
- Card 2's window tops back up to that same size using leftovers from Card 1's window plus fresh arrivals (see "The Rolling Window" above), and so on for each additional card. The effective size stays constant across every card in one Suggest-All pass, since it's derived from the queue snapshot the whole batch shares — it only changes between separate suggestion actions, once the queue itself has actually moved (a court assignment, a new arrival, etc.).
- Selected players are excluded from all subsequent cards' windows in the same round — nobody is suggested for two courts at once.

---

## UI Flow

### Dashboard — Matchup Planning Cards
Each planning card on the Dashboard is independently powered by the Smart Suggest algorithm:
- Cards are auto-generated on session load (default 3); the `↺ Resuggest` button re-runs the algorithm for a single card
- No scores or percentages are shown — just the suggested players on each side
- Cards draw from the rolling window described above (10+, scaling with session size), in card order
- If fewer eligible candidates exist than the match type requires, the card shows an **Empty** state with a "Not enough players" note — no button rendered

### The Suggest Button (header, fills every open card)
One click fills **every card that isn't already `ready`** in a single pass — both `empty` cards (full generate) and `proposed`/partially-filled cards (lock-and-fill, below) — threading exclusions across cards as it goes, so no card in the same pass can pick a player another one just claimed. `ready` cards are left untouched, since they have no open slots to fill. If every card is already `ready`, it adds one new card and fills it, matching the previous single-card behavior.

### Resuggest (per-card, `↺`)
Scoped to one card, but still cross-card aware — it excludes players other cards have already claimed, the same way the header Suggest does. Its behavior depends on the card's state:
- **`empty`**: full generate, same as before.
- **`proposed`** (partially filled): **lock-and-fill** — every already-placed player stays exactly where they are; only the open slots are searched, scored, and filled from the queue. If the queue can't currently cover the remaining open slots, the card is left exactly as it was rather than being wiped back to empty.
- **`ready`**: full reshuffle of the whole card, same as before.

Manually placed players (drag or tap-to-place) are never touched by either button unless a lock-and-fill pass is explicitly re-run on their card and the organizer removes them first — Suggest and Resuggest only ever fill *open* slots, never reassign a slot that's already occupied.

### Within a Planning Card
- Shows Side A and Side B player chips (name + skill badge)
- Chips are draggable between sides on desktop for manual override; on mobile, tap to select then tap an empty slot to swap
- Match type toggle (Singles / Doubles) on the card header; switching re-triggers suggestion
- "Assign to Court" button or drag-to-court sends the card to a court and starts the match (see `05-queue-matchup.md` for the full assignment flow)

---

## Server Actions (`src/server/actions/smart-matchup.ts`)

```typescript
getSuggestedMatchup(
  sessionId: string,
  matchType: MatchType,
  excludedPlayerIds: string[],
  lockedPlacement?: { sideA: (Player | null)[]; sideB: (Player | null)[] }
): Promise<MatchupSuggestion | null>

type MatchupSuggestion = {
  sideA:           (Player | null)[]
  sideB:           (Player | null)[]
  pairsExhausted:  boolean   // true = all unique arrangements used this session
}
```

`excludedPlayerIds` carries the players already selected by earlier cards in the same round, so each card's window correctly excludes them.

`lockedPlacement` is present only for a lock-and-fill call (Resuggest or the header Suggest button touching a `proposed` card): the card's current `sideA`/`sideB`, nulls and all. Every non-null slot is treated as fixed; only the null slots are searched for. Returns `null` if the queue can't currently cover the open slots — the caller leaves the card's existing placement untouched in that case rather than clearing it.

---

## Configuration (stored in Settings)

| Setting | Default | Description |
|---|---|---|
| `balanceWeight` | 0.6 | Weight for balance score (novelty weight = 1 − this) |
| `smartMatchupEnabled` | true | Show/hide the Smart Suggest button entirely |

## Constants (not organizer-configurable)

| Constant | Default | Description |
|---|---|---|
| `windowSize` | 10 | Floor of the candidate window — the flat size any session under ~20 waiting still sees |
| `maxWindowSize` | 24 | Ceiling the window scales up to as the waiting queue grows (see "Scaling the window" above) |
| `skipCapThreshold` | 2 | Consecutive skips before a player is force-included |

---

## Data Queries

**Session win rate** (balance scoring):
```typescript
// Completed matches for a player in this session
// win rate = wins / matchesPlayed; default 0.5 if matchesPlayed = 0
async function getSessionWinRate(playerId: string, sessionId: string): Promise<number>
```

**Session pair count** (novelty scoring):
```typescript
// How many times playerA and playerB appeared on the same side (doubles)
// or in the same match (singles) in COMPLETED matches this session
async function countSessionPairings(
  playerA: string,
  playerB: string,
  sessionId: string
): Promise<number>
```

**Session skip count** (fairness safeguard):
```typescript
// How many consecutive times this player has appeared in a suggestion
// window without being selected, this session. Resets to 0 when selected.
async function getSessionSkipCount(playerId: string, sessionId: string): Promise<number>
```

---

## Edge Cases
- **Player has 0 session matches**: win rate defaults to 0.5 (neutral) for the Win-Rate Balance tiebreak; skill level alone carries the main Balance Score. The player is also first-game-priority eligible (see Fairness Safeguards).
- **All candidates have equal final scores, challenge counts, and win-rate balance**: first arrangement by arrival order is returned
- **Only 2 eligible players, match type is doubles**: "Smart Suggest" disabled — tooltip: "Need at least 4 available players for doubles"
- **Bench player manually dragged into a planning card**: allowed — the drag-to-card flow is a manual override, not algorithm-driven
- **`balanceWeight` set to 1.0**: novelty ignored entirely; pure skill balance
- **`balanceWeight` set to 0.0**: novelty only; ignores skill balance
- **Window can't support any exact-level or adjacent-level group**: level preference silently drops to unrestricted for that card; no UI note needed
- **Window can't support any same-gender or mixed-doubles group within the chosen level tier**: gender preference silently drops to unrestricted within that tier; no UI note needed
- **Fewer than 10 eligible players remain in the queue**: window is simply capped at whatever's available; falls through to the standard "not enough players" disable if it drops below the match-type minimum
- **A player hits the skip cap or is on their first game, while also being the only option for a same-gender/mixed-doubles or same/adjacent-level slot**: force-inclusion still respects the active level and gender tiers — they're forced into a valid arrangement within those tiers, not into a tier the window doesn't support
- **Lock-and-fill (Resuggest or header Suggest on a `proposed` card) can't cover the remaining open slots**: the card's existing placement is left exactly as it was — never wiped back to empty just because a fill attempt came up short
- **Header Suggest clicked with no `empty` or `proposed` cards**: behaves like the old single-card Suggest — adds one new card and fills it
- **Header Suggest with multiple `proposed` cards contending for the same small pool of remaining queue players**: cards are filled in on-screen order; a card later in the list may end up left as-is (or only partially improved) if earlier cards in the same pass already claimed the available candidates — same "first come, first filled" principle as the existing round-robin multi-card exclusion
- **A player checks in or gets assigned to a court mid-round, changing the waiting count right at a scaling threshold (e.g. 19 → 20)**: harmless — the next `suggestMatchup` call simply recomputes the effective window size from the current queue; there's no stored "locked-in" window size to go stale
