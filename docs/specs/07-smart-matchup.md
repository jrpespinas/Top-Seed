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
Each planning card evaluates a **window of 10 eligible players**, drawn in arrival order. The window is not a fixed slice — it's a rolling buffer that stays at size 10 across the whole planning-card sequence for a round:

1. **Card 1** opens with the earliest 10 eligible players in the queue.
2. It selects the best-scoring group (4 for doubles, 2 for singles) out of that window. The players **not** selected remain in the window.
3. **Card 2's** window is topped back up to 10 by pulling in exactly as many *new* players from further down the queue as were just selected out — e.g. 4 leftover + 4 fresh arrivals for doubles.
4. This repeats for every additional card/court opened in the same round: leftovers always carry forward, new arrivals only backfill the difference.

This keeps every card's decision scoped to the same constant field of 10, rather than a pool that grows with each additional court. A player who scores poorly against one window's competition isn't compared against an ever-larger field in the next round — they reappear in a same-sized window, which keeps their odds of eventually being picked from silently shrinking round over round.

**Minimum thresholds:**
- Doubles needs at least 4 eligible players in the window; singles needs at least 2.
- If the queue can't fill the window to that minimum (including all remaining eligible players), Smart Suggest is disabled for that card — no button rendered.

---

## Scoring a Matchup

For a given window, every valid group of players (a group of 4 for doubles, 2 for singles) drawn from that window, and every way to split that group into two sides, is a candidate arrangement. Each is scored; the highest-scoring one is suggested — subject to the gender preference gate below, which is applied before scoring narrows the candidate set.

### 0. Gender Preference (gate, applied before scoring)
Real badminton has same-gender and mixed-gender formats; the suggestion prefers the more specific one when the window supports it, in this order:

1. **Same-gender** — all 4 players (doubles) or both players (singles) share a gender. If at least one same-gender group exists in the window, only same-gender groups are scored.
2. **Mixed Doubles convention** (doubles only) — if no same-gender group exists but the window has at least 2 men and 2 women, only groups of exactly 2-and-2 are considered, and only splits where each side has one of each gender (true mixed doubles, not an arbitrary split).
3. **Unrestricted** — if neither tier is possible, gender is dropped for this round and all groups/splits are scored normally.

Players with `gender` unset act as wildcards: they don't block a same-gender or mixed-doubles arrangement, and they aren't the reason one gets chosen either — they're simply excluded from the gender check itself.

### 1. Balance Score (weight: 60%)
Measures how evenly matched the two sides are using skill level and current-session win rate.

```typescript
function sideStrength(players: Player[], sessionId: string): number {
  const skillRank = { S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7 }
  // normalize to 0–1 where 1 = strongest
  const avgSkill = mean(players.map(p => (8 - skillRank[p.skillLevel]) / 7))
  // win rate from current session only
  const avgWinRate = mean(players.map(p => getSessionWinRate(p.id, sessionId)))
  return avgSkill * 0.5 + avgWinRate * 0.5
}

function balanceScore(sideA: Player[], sideB: Player[], sessionId: string): number {
  const diff = Math.abs(sideStrength(sideA, sessionId) - sideStrength(sideB, sessionId))
  return 1 - diff / MAX_POSSIBLE_DIFF  // 1 = perfectly balanced
}
```

`getSessionWinRate(playerId, sessionId)`: wins ÷ matchesPlayed within this session. Returns 0.5 (neutral) if the player has no matches yet this session — defaulting to neutral avoids penalising new players.

### 2. Challenge Preference (tiebreak within Balance)
Balanced sides are usually competitive, but balance alone doesn't guarantee a player faces real opposition — two weak players paired together can look "balanced" against another weak pair without pushing anyone. When multiple arrangements land within a small margin of each other on Balance Score, prefer the one that gives the most players an opponent at or above their own skill level, rather than the one that gives anyone an easy win. This only breaks near-ties; it never overrides a clearly better Balance Score, and it never forces a pairing the window can't support — if every option in the window pairs someone down, that's simply the best available game this round.

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
// Challenge Preference applies as a tiebreak among near-equal finalScores,
// after the Gender Preference gate has already narrowed the candidate set.
```

---

## Fairness Safeguard: Skip Cap

Because scoring can legitimately pass over a player in the window in favor of a better-scoring group, the system tracks how many consecutive times each player has been present in a window but not selected into the winning arrangement.

- Each time a suggestion runs and a player is in the window but not chosen, their skip count increments.
- Each time a player is chosen, their skip count resets to 0.
- Skip counts are session-scoped — they don't carry over between sessions.
- If a player's skip count reaches the cap (default: **2**), the next time they appear in a window they are **force-included** in the selected group regardless of score; the remaining slots and side-split are still chosen to score as well as possible around that forced inclusion.

This is a backstop, not the common case — with a 10-wide window, most players are picked well before hitting the cap. It exists for the rare outlier (an unusual skill level, or the only player of a given gender) who could otherwise be repeatedly out-scored round after round.

---

## Repeat Pair Exhaustion

When every possible arrangement available in the current window (after the gender gate) has already been played this session:
- Falls back to the least-recently-paired arrangement among them
- UI shows a subtle note: "All unique pairs used — suggesting least recently repeated"

With a 10-wide window this is now a much rarer fallback than under a fixed 4-player pool, since the number of valid arrangements is far larger — but it can still happen in a small or long-running session.

---

## Multi-Court Handling

When multiple planning cards are open at once (multiple courts to fill in the same round):
- Card 1 draws the first window of 10 and selects its group.
- Card 2's window tops back up to 10 using leftovers from Card 1's window plus fresh arrivals (see "The Rolling Window" above), and so on for each additional card.
- Selected players are excluded from all subsequent cards' windows in the same round — nobody is suggested for two courts at once.

---

## UI Flow

### Dashboard — Matchup Planning Cards
Each planning card on the Dashboard is independently powered by the Smart Suggest algorithm:
- Cards are auto-generated on session load (default 3); the `↺ Resuggest` button re-runs the algorithm for a single card
- No scores or percentages are shown — just the suggested players on each side
- Cards draw from the rolling 10-wide window described above, in card order
- If fewer eligible candidates exist than the match type requires, the card shows an **Empty** state with a "Not enough players" note — no button rendered

### Within a Planning Card
- Shows Side A and Side B player chips (name + skill badge)
- Chips are draggable between sides on desktop for manual override; on mobile, tap to select then tap an empty slot to swap
- Match type toggle (Singles / Doubles) on the card header; switching re-triggers suggestion
- "Assign to Court" button or drag-to-court sends the card to a court and starts the match (see `05-queue-matchup.md` for the full assignment flow)

---

## Server Actions (`src/server/actions/smart-matchup.ts`)

```typescript
getSuggestedMatchup(sessionId: string, matchType: MatchType, excludedPlayerIds: string[]): Promise<MatchupSuggestion>

type MatchupSuggestion = {
  sideA:           Player[]
  sideB:           Player[]
  pairsExhausted:  boolean   // true = all unique arrangements used this session
}
```

`excludedPlayerIds` carries the players already selected by earlier cards in the same round, so each card's window correctly excludes them.

---

## Configuration (stored in Settings)

| Setting | Default | Description |
|---|---|---|
| `balanceWeight` | 0.6 | Weight for balance score (novelty weight = 1 − this) |
| `smartMatchupEnabled` | true | Show/hide the Smart Suggest button entirely |

## Constants (not organizer-configurable)

| Constant | Default | Description |
|---|---|---|
| `matchupWindowSize` | 10 | Size of the rolling candidate window per card |
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
- **Player has 0 session matches**: win rate defaults to 0.5 (neutral); skill level carries the balance score
- **All candidates have equal final scores**: first arrangement by arrival order is returned
- **Only 2 eligible players, match type is doubles**: "Smart Suggest" disabled — tooltip: "Need at least 4 available players for doubles"
- **Bench player manually dragged into a planning card**: allowed — the drag-to-card flow is a manual override, not algorithm-driven
- **`balanceWeight` set to 1.0**: novelty ignored entirely; pure skill/win-rate balance
- **`balanceWeight` set to 0.0**: novelty only; ignores skill balance
- **Window can't support any same-gender or mixed-doubles group**: gender preference silently drops to unrestricted for that card; no UI note needed
- **Fewer than 10 eligible players remain in the queue**: window is simply capped at whatever's available; falls through to the standard "not enough players" disable if it drops below the match-type minimum
- **A player hits the skip cap while also being the only option for a same-gender/mixed-doubles slot**: force-inclusion still respects the active gender tier — they're forced into a valid arrangement within that tier, not into a tier the window doesn't support
