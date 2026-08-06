# Spec: Smart Matchup Suggestion

## Scope
Algorithm-driven matchup suggestion that balances competitive fairness, game intensity, pairing variety, and gender composition. Extends the basic queue-order suggestion in `05-queue-matchup.md`.

---

## What Changed From Basic Suggestion
Basic suggestion: take the next N players in queue order.
Smart suggestion: draw candidates from per-skill-level pools, score all valid arrangements within whichever pool is active, and return the best one.

---

## Candidate Pool

### Eligibility
A player is eligible to appear in any candidate pool if they are:
- In the **queue** for the current session (bench players are excluded)
- Not currently in an `IN_PROGRESS` match

Arrival order is determined by `sessionJoinedAt` on `QueueEntry` — the timestamp when the player first entered the session, which never resets on re-queue. This ensures players who checked in earlier retain their seniority even after returning from a match.

### Per-Level Candidate Pools
Earlier versions of this algorithm drew every candidate from one shared, arrival-ordered window regardless of skill level — workable in small sessions, but in a large one (many courts, dozens of players) a single skill level can easily be scattered wider through the queue than any reasonably-sized shared window could see, so the same handful of same-level players nearby in arrival order keep getting matched against each other while others at that level, waiting just a bit further back, never become candidates.

Instead, for a **fresh, full-group suggestion** (an `empty` card, or the header Suggest button's full-generate case), candidates are drawn from a **dedicated pool for one specific skill level**, not a shared window:

1. **Pick a level to serve.** Look at every eligible waiting player's skill level, and find the single player who's been waiting the longest overall (earliest `sessionJoinedAt`) — their level is the one this card tries to serve. (This is equivalent to, but simpler than, computing each level's own oldest member and comparing across levels: the single globally-oldest player's level *is* the level whose oldest member is earliest, by definition.)
2. **Exact-level pool**: every eligible waiting player at that exact level, in arrival order, capped at `maxWindowSize` (24 — a defensive ceiling on the combinatorics, not a fairness dial, since a single level is already a naturally small slice of the session).
3. **Adjacent-level pool**, tried only if the exact pool doesn't yield a fresh result (see "Freshness-Gated Escalation" below): every eligible waiting player at that level *or* its immediate neighbor rank, arrival-ordered, same cap. Individual groups drawn from this pool still must independently satisfy the adjacent-level spread rule (see Level Preference below) — the pool itself is just the union of who's allowed to appear.
4. **Unrestricted pool**, tried only if both of the above fail: the full eligible queue, arrival-ordered, sized by the same scaled-window formula used previously:

```typescript
function effectiveWindowSize(waitingCount: number): number {
  return clamp(Math.floor(waitingCount / 2), windowSize, maxWindowSize) // 10, 24
}
```
   Sessions under ~20 waiting see window 10 (unchanged); it scales up gradually past that, capping at 24 once ~48+ are waiting. `waitingCount` here is the full session-wide waiting count, not scoped to this card's own exclusions — "how much variety exists in the room" doesn't shrink just because earlier cards this round already claimed a few players.

A **lock-and-fill** call (Resuggest or header Suggest touching a `proposed` card) works differently: the already-placed players already pin down most of the level context, so there's no "which level to serve" decision to make. It draws new candidates from one shared pool (the Unrestricted-sized window above) and tries the same Exact → Adjacent → Unrestricted progression by filtering *that* pool's combinations against the locked players, rather than building three separate per-level pools.

**Minimum thresholds:**
- Doubles needs at least 4 eligible players in total; singles needs at least 2.
- If there aren't enough eligible players anywhere in the queue to meet that minimum, Smart Suggest is disabled for that card — no button rendered.

---

## Scoring a Matchup

Within whichever pool is currently being tried (Exact, Adjacent, or Unrestricted — see Per-Level Candidate Pools above), every valid group of players (a group of 4 for doubles, 2 for singles), and every way to split that group into two sides, is a candidate arrangement. Each is scored; the highest-scoring one is suggested — subject to two gates applied before scoring narrows the candidate set: Level Preference first, Gender Preference second, nested inside it.

### 0a. Level Preference (outer gate) — Freshness-Gated Escalation
"As much as possible, all players the same level" outranks everything else, including gender — a same-level mixed group is preferred over a same-gender group spanning several levels. But existence alone isn't enough to win a tier anymore: a level whose players have already played every combination of each other doesn't get to keep winning just because a same-level group is technically still possible — that let a small pool of Advanced players get stuck replaying each other every single round, which is exactly the bug this fixes. Tried in order, **escalating only when the current tier has no *fresh* (never-played-this-session) arrangement available**, not merely when a group exists:

1. **Exact level** — every player shares one skill level, drawn from the Exact-level pool. Used only if at least one **fresh** exact-level arrangement exists there.
2. **Adjacent level** — the group's skill levels span at most one rank (e.g. B and A, but not B and S), drawn from the Adjacent-level pool (the served level plus its immediate neighbor). Tried only once Exact has no fresh option left (either not enough same-level players, or every same-level arrangement has already been played) — used only if at least one **fresh** adjacent-level arrangement exists there.
3. **Unrestricted** — tried only once Adjacent also has no fresh option. Level is dropped entirely for this round; the best-scoring arrangement is used regardless of freshness (this is the one tier where "best available" wins even if every option has already been played — see Repeat Pair Exhaustion below).

A level with too few waiting players to form even one group behaves the same as a level whose groups are all stale: no fresh (or any) arrangement, escalate.

### 0b. Gender Preference (inner gate, applied within the chosen level tier)
Real badminton has same-gender and mixed-gender formats; within whichever pool the level gate settled on, the suggestion prefers the more specific gender arrangement when that pool supports it, in this order:

1. **Same-gender** — all 4 players (doubles) or both players (singles) share a gender. If at least one same-gender group exists, only same-gender groups are scored.
2. **Mixed Doubles convention** (doubles only) — if no same-gender group exists but the pool has at least 2 men and 2 women, only groups of exactly 2-and-2 are considered, and only splits where each side has one of each gender (true mixed doubles, not an arbitrary split). This is the deliberate last resort: mixed gender is only ever reached after level compatibility has already been settled.
3. **Unrestricted** — if neither tier is possible, gender is dropped for this round and all groups/splits (within the chosen level tier) are scored normally.

Players with `gender` unset act as wildcards: they don't block a same-gender or mixed-doubles arrangement, and they aren't the reason one gets chosen either — they're simply excluded from the gender check itself. Gender constraints can themselves eat into a level tier's freshness: with an odd gender split, some skill-valid splits may be gender-invalid, so a level's arrangements can run out of fresh *gender-valid* options sooner than its raw player count would suggest — which is a legitimate, expected reason to escalate, not a bug.

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

In practice this now almost always means the Exact and Adjacent pools were both exhausted and the search fell all the way to Unrestricted — with dedicated per-level pools doing most of the work of keeping arrangements fresh, actually reaching this fallback is rarer than it was even under the previous shared-window design, but it can still happen in a small or long-running session, or a level with very few players relative to how many rounds it's played.

---

## Multi-Court Handling

When multiple planning cards are open at once (multiple courts to fill in the same round):
- Card 1 looks at every eligible waiting player, finds whoever's been waiting longest overall, and serves *their* skill level first (see "Per-Level Candidate Pools" above) — ties fall back to raw arrival order, which is already how the "longest waiting" comparison is computed, so no separate tiebreak logic is needed.
- Its picked players are excluded from every subsequent card's pools in the same round — nobody is suggested for two courts at once, and a level that just lost its available players to Card 1 won't be servable again until the round changes.
- Card 2 repeats the same "who's waited longest now" search against the reduced pool, and so on for each additional card. This means the level served can change from card to card within one round — e.g. Card 1 serves Beginner (the longest-waiting player happened to be a Beginner), Card 2 then serves Advanced (now the longest-waiting *remaining* player is Advanced) — there's no fixed rotation order beyond "whoever's waited longest, right now."
- The Unrestricted tier's window (used only once a card's chosen level is fully exhausted) stays sized consistently across one Suggest-All pass, since `waitingCount` is computed from the same queue snapshot the whole batch shares; it only changes between separate suggestion actions, once the queue itself has actually moved (a court assignment, a new arrival, etc.).

---

## UI Flow

### Dashboard — Matchup Planning Cards
Each planning card on the Dashboard is independently powered by the Smart Suggest algorithm:
- Cards are auto-generated on session load (default 3); the `↺ Resuggest` button re-runs the algorithm for a single card
- No scores or percentages are shown — just the suggested players on each side
- Cards draw from per-level candidate pools described above, serving whichever skill level has waited longest at the time each card is filled
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
| `windowSize` | 10 | Floor of the Unrestricted-tier window — the flat size any session under ~20 waiting still sees |
| `maxWindowSize` | 24 | Ceiling both the Unrestricted window and any single Exact/Adjacent level pool scale up to — defensive on the combinatorics, not a fairness dial for the level pools (see "Per-Level Candidate Pools" above) |
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
- **The served level's Exact and Adjacent pools both fail to produce a fresh arrangement**: level preference drops to Unrestricted for that card; no UI note needed
- **The chosen level pool can't support any same-gender or mixed-doubles group**: gender preference silently drops to unrestricted within that tier; no UI note needed
- **An odd gender split eliminates some skill-valid arrangements** (e.g. 3 men and 1 woman among 4 same-level players — no valid mixed-doubles split exists, only one specific same-gender-per-side split does): the level's fresh-arrangement count can run out sooner than raw player count would suggest, since gender-invalid splits never count toward freshness in the first place — a legitimate, expected trigger for escalation, not a bug. Verified directly: a 4-player Advanced-only pool with a 2M/2F split only has 2 of its 3 possible doubles splits pass the mixed-doubles gender check, so it escalates to Adjacent after 2 rounds, not 3.
- **A skill level has too few waiting players to form even one group** (e.g. only 2 Advanced players waiting, doubles needs 4): behaves identically to a level whose groups are all stale — no fresh (or any) arrangement, escalate to Adjacent.
- **Fewer than 10 eligible players remain in the queue overall**: the Unrestricted-tier window is simply capped at whatever's available; falls through to the standard "not enough players" disable if it drops below the match-type minimum
- **A player hits the skip cap or is on their first game, while also being the only option for a same-gender/mixed-doubles or same/adjacent-level slot**: force-inclusion still respects the active level and gender tiers — they're forced into a valid arrangement within whichever pool is active, not into a tier that pool doesn't support
- **Lock-and-fill (Resuggest or header Suggest on a `proposed` card) can't cover the remaining open slots at any tier**: the card's existing placement is left exactly as it was — never wiped back to empty just because a fill attempt came up short
- **Header Suggest clicked with no `empty` or `proposed` cards**: behaves like the old single-card Suggest — adds one new card and fills it
- **Header Suggest filling multiple cards in one pass**: each card independently re-evaluates "who's waited longest now" against the pool already reduced by earlier cards in the same pass (see Multi-Court Handling) — the level served can change from card to card, and a card later in the list may end up left as-is if earlier cards already claimed the only players who could've filled it.
- **A player checks in or gets assigned to a court mid-round, changing the waiting count right at the Unrestricted tier's scaling threshold (e.g. 19 → 20)**: harmless — the next `suggestMatchup` call simply recomputes it from the current queue; there's no stored "locked-in" window size to go stale
- **Two levels tie for "longest waiting" exactly**: can't actually happen — the comparison is a strict less-than over parsed timestamps, so the first one encountered in queue order wins deterministically; no separate tiebreak rule was needed.
