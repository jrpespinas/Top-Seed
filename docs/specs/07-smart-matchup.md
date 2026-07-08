# Spec: Smart Matchup Suggestion

## Scope
Algorithm-driven matchup suggestion that balances competitive fairness and pair novelty. Extends the basic queue-order suggestion in `05-queue-matchup.md`.

---

## What Changed From Basic Suggestion
Basic suggestion: take the next N players in queue order.
Smart suggestion: score all possible arrangements from the candidate pool and return the best one.

---

## Candidate Pool

Eligible players are those who are:
- In the **queue** for the current session (bench players are excluded)
- Not currently in an `IN_PROGRESS` match

Arrival order is determined by `sessionJoinedAt` on `QueueEntry` — the timestamp when the player first entered the session, which never resets on re-queue. This ensures players who checked in earlier retain their seniority even after returning from a match.

**Pool size used:**
- Take the earliest-added **4 candidates** from the queue
- Score all possible arrangements within that cohort
- If fewer than 2 (singles) or 4 (doubles) eligible players exist, "Smart Suggest" is disabled

---

## Scoring a Matchup

For doubles with 4 candidates [P1, P2, P3, P4], there are 3 possible team arrangements:
- [P1,P2] vs [P3,P4]
- [P1,P3] vs [P2,P4]
- [P1,P4] vs [P2,P3]

For singles with 4 candidates, there are 6 possible opponent pairs:
- P1vP2, P1vP3, P1vP4, P2vP3, P2vP4, P3vP4

Each arrangement is scored; the highest-scoring one is suggested.

### 1. Balance Score (primary, weight: 60%)
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

### 2. Novelty Score (tiebreaker, weight: 40%)
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
```

---

## Repeat Pair Exhaustion

When every possible arrangement within the candidate pool has been played at least once this session:
- Falls back to least-recently-paired arrangement
- UI shows a subtle note: "All unique pairs used — suggesting least recently repeated"

---

## UI Flow

### Dashboard — Matchup Planning Cards
Each planning card on the Dashboard is independently powered by the Smart Suggest algorithm:
- Cards are auto-generated on session load (default 3); the `↺ Resuggest` button re-runs the algorithm for a single card
- No scores or percentages are shown — just the suggested players on each side
- Cards are generated with the same exclusion chain: Card 1 draws from the full pool; Card 2 excludes Card 1's players; and so on
- If fewer eligible candidates exist than the match type requires, the card shows an **Empty** state with a "Not enough players" note — no button rendered

### Within a Planning Card
- Shows Side A and Side B player chips (name + skill badge)
- Chips are draggable between sides on desktop for manual override; on mobile, tap to select then tap an empty slot to swap
- Match type toggle (Singles / Doubles) on the card header; switching re-triggers suggestion
- "Assign to Court" button or drag-to-court sends the card to a court and starts the match (see `05-queue-matchup.md` for the full assignment flow)

---

## Server Actions (`src/server/actions/smart-matchup.ts`)

```typescript
getSuggestedMatchup(sessionId: string, matchType: MatchType): Promise<MatchupSuggestion>

type MatchupSuggestion = {
  sideA:           Player[]
  sideB:           Player[]
  pairsExhausted:  boolean   // true = all unique arrangements used this session
}
```

---

## Configuration (stored in Settings)

| Setting | Default | Description |
|---|---|---|
| `balanceWeight` | 0.6 | Weight for balance score (novelty weight = 1 − this) |
| `smartMatchupEnabled` | true | Show/hide the Smart Suggest button entirely |

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

---

## Edge Cases
- **Player has 0 session matches**: win rate defaults to 0.5 (neutral); skill level carries the balance score
- **All candidates have equal final scores**: first arrangement by arrival order is returned
- **Only 2 eligible players, match type is doubles**: "Smart Suggest" disabled — tooltip: "Need at least 4 available players for doubles"
- **Bench player manually dragged into a planning card**: allowed — the drag-to-card flow is a manual override, not algorithm-driven
- **`balanceWeight` set to 1.0**: novelty ignored entirely; pure skill/win-rate balance
- **`balanceWeight` set to 0.0**: novelty only; ignores skill balance
