# Spec: Leaderboard

## Scope
Session-scoped rankings only. Stats (wins, draws, win rate) reflect a single session — no cross-session aggregation.

---

## Data Model Notes
- `Match.sessionId` links every match to the session it was played in
- Leaderboard always queries within one session at a time
- `VOIDED` and `IN_PROGRESS` matches excluded
- Walkover: winning side +1 win; losing side +1 matchesPlayed only

---

## Pages & Components

### `/leaderboard` — Rankings

**Session selector (top of page):**
- Dropdown of past sessions ordered by date descending
- Defaults to the current open session
- Changing session rerenders both tabs

**Tabs: Singles | Doubles**
Each tab is an independent leaderboard for that match type within the selected session.

### Leaderboard Table Columns

| # | Player | Level | Matches | Wins | Draws | Win Rate |
|---|--------|-------|---------|------|-------|----------|
| 1 | Alice  | A     | 8       | 6    | 1     | 75%      |
| 2 | Bob    | B     | 7       | 4    | 0     | 57%      |

- **Win Rate** = wins ÷ matches played
- Rank 1: trophy icon; Rank 2–3: medal icon; all others: number
- Clicking a player row navigates to `/players/[id]`
- Tiebreaker order: Win Rate → Wins → Matches Played → Name (alphabetical)

### Components
- `SessionSelector` — dropdown, defaults to current open session
- `LeaderboardTabs` — Singles / Doubles; preserves selected session across tab switch
- `LeaderboardTable` — sortable by any column header (client-side re-sort)
- `RankBadge` — trophy / medal / number
- `WinRateBar` — mini progress bar 0–100%

---

## Data Fetching

```typescript
// src/server/queries/leaderboard.ts
async function getLeaderboard(filter: {
  sessionId: string    // required
  matchType: MatchType // required — SINGLES or DOUBLES
}): Promise<LeaderboardRow[]>

type LeaderboardRow = {
  playerId:      string
  playerName:    string
  skillLevel:    SkillLevel
  matchesPlayed: number
  wins:          number
  draws:         number
  winRate:       number  // wins / matchesPlayed, 0–1 float
}
```

## Query Logic

```typescript
// Filter: match.sessionId = sessionId, match.matchType = matchType, match.status = COMPLETED
// For each player in those matches:
//   matchesPlayed = COUNT of matches player appeared in
//   wins          = COUNT where match.result = player's side (walkover winning side included)
//   draws         = COUNT where match.result = DRAW
//   winRate       = wins / matchesPlayed
//
// Walkover losing side: matchesPlayed += 1, no win added
// Order: winRate DESC, wins DESC, matchesPlayed DESC, playerName ASC
```

---

## Constraints
- Player must have ≥1 completed match in the session to appear
- No cross-session aggregation anywhere in this feature
- Each tab queries independently

---

## Edge Cases
- **No completed matches in session yet**: empty state — "No completed matches this session"
- **Session with only voided matches**: same empty state
- **Player with only draws**: winRate = 0%, draws column shows count
- **Player deactivated mid-session**: still appears if they have completed matches in the session
- **Only one session exists**: session selector shows one option; still shown (not hidden)
