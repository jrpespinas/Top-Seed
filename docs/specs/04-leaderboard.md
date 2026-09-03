# Spec: Leaderboard

## Scope
Session-scoped rankings only. Every number reflects a single session — no cross-session aggregation anywhere in this feature.

This is also the **only** surface in the app where a player's performance is expressed at all; there is no `/players/[id]` profile route. It is read *after* a session rather than during one, which is why it is the one page that trades operational restraint for a result you would want to screenshot.

---

## Data Model Notes
- `MatchRecord.sessionId` links every match to the session it was played in
- `VOIDED` and `IN_PROGRESS` matches are excluded from every calculation
- A player must have ≥1 completed match in the session to appear
- `isWalkover` is specced in `ARCHITECTURE.md` and `03-match-management.md` but **does not exist in `src/`** — no field on `MatchRecord`, no recording UI. When it ships, the winning side takes a win and the losing side takes no loss and no match played, which means the ranking below has to be revisited: a walkover would otherwise inflate the winner's Points and deflate the loser's Form.

---

## Ranking

### Points — the headline, and the default sort

```
Points = 3·W + 1·D + Σ bonus(match)
```

Additive, verifiable by the player who earned them, and the one number that cannot deflate on a perfect record.

**This replaced a Wilson score lower bound**, which was the right idea applied at the wrong sample size. Wilson was built for samples in the hundreds; a session produces two to eight matches per player, and at that size the confidence correction stops adjusting the signal and *becomes* the signal. A 5–0 record rendered as **57%** — below what any reader would call average — and eleven players compressed into a 57→21 band with four-way ties on 30%.

### bonus(match) — difficulty credit, wins only

```
sideAvg     = mean SKILL_RANK of your side
oppAvg      = mean SKILL_RANK of their side
difficulty  = max(0, round(sideAvg − oppAvg))
carry       = sideAvg > oppAvg ? max(0, rank(partner) − rank(you)) : 0
bonus       = min(3, difficulty + carry)
```

`SKILL_RANK` counts upward as players get weaker (Advanced 1 → Casual 4), so a positive difference means your side was the underdog.

Three rules carry this:

- **Bonus only, never a penalty.** If beating a weaker player or partnering with one cost you rating, the strongest players would stop mixing to protect a number and the session would get socially worse. An inaccurate ranking is a far cheaper problem than a leaderboard that discourages people from playing with beginners.
- **Carry is gated on being the underdog.** Without the gate, an Advanced player paired with a Casual against two Casuals collects full carry credit for a match they were always going to win.
- **Capped at +3 — no single match beats two clean wins.** Rarely binds in practice: `isAdjacentLevel` constrains suggested matchups to one rung apart, so the typical bonus is 0 or 1. The cap guards hand-dragged extremes.

### Form — the tiebreak

```
Form = (W + 0.5·D + 1) / (N + 2)
```

Bayesian shrinkage with two pseudo-matches, which explains itself in one sentence: **everyone starts the day 1–1.** Same goal as Wilson — an unproven record can't out-rank a real one — but legible at small n: 5–0 reads 86%, 20–2 reads 87.5%, so a genuine track record still edges ahead.

### Draws
Worth `1` point and half a win in Form. **This was a bug**: `winRate` divided wins by a denominator that counted draws, and the Wilson bound took `(wins, played)` directly, so a draw scored exactly as a loss. An undefeated 3W–1D–0L and a beaten 3W–0D–1L came out identical and tied.

### Ordering
Primary sort key → Form → matches played. Competition ranking (1, 2, 2, 4 — never 1, 2, 2, 3); a row shares the previous rank only on a genuine tie across every criterion, and is flagged `isTied` so the UI can prefix `T-`. Ties are far rarer than under a percentage: identical rates were common, identical point totals *with* identical form much less so.

### Sorts
`points` (default) · `form` · `wins` · `matchesPlayed`. Match-type filter: Singles / Doubles / Combined.

---

## Derived stats

All computed in `src/lib/leaderboard.ts` from the existing match log, all covered by `leaderboard.test.ts`.

| Stat | Rule |
|---|---|
| `currentStreak` | Consecutive wins ending at the most recent match. A draw breaks it. |
| `longestStreak` | Longest such run in the session. |
| `bestUpset` | The single win that earned the most bonus, with opponent names. |
| `bestPartner` | Most wins alongside one partner, **minimum two matches together**. |
| `timeOnCourtMs` | Σ of `endedAt − startedAt` over completed matches. |

Matches are sorted chronologically before any of this runs — the match log hands records back newest-first, and a streak read in that order would be the reverse of what happened.

**Head-to-head was specced and deliberately not built.** Nothing in the design displays it, and an untriggerable code path is the same problem as the unimplemented `isWalkover` branch.

---

## Layout — `/leaderboard`

### The apex

Five players recognised in one composition, with the first holding the centre. Three tiers, each a visibly different object rather than the same card at three sizes:

1. **Champion** — filled brand blue, largest, centre column on desktop and full width on mobile. Carries the rank numeral, name, points, record, form, and one generated sentence (`championSummary`) assembled from what actually happened. Returns `null` rather than filler when nothing specific is true; an empty line reads better than "had a good session".
2. **Runners-up** — outlined in the same blue, roughly a third of the champion's presence, flanking it at `md:` and paired beneath on mobile.
3. **Honors** — neutral, quietest, two slots. An honor recognises a moment, not a placing.

**Ranks 1–2–3 deliberately do not use gold / silver / bronze.** That ladder is already spoken for: `SkillBadge` runs Bronze → Silver → Gold → Platinum for Casual → Beginner → Intermediate → Advanced, and those badges render *inside* these slots. A gold rank-1 frame beside a gold Intermediate badge would be one visual system saying two unrelated things. Hierarchy runs on the brand blue, size, and position instead.

### Honor selection (`selectHonors`)

Priority pool: **biggest upset → longest streak → most on court → best pair.** Fill two, in order, skipping any that don't exist.

- **Anyone already on the podium is excluded.** A 5–0 champion owns the longest streak by construction; awarding it to them would recognise four people where the layout has room for five. Dropping to the best streak outside the top three is what makes the apex five distinct names.
- **One honor per player**, for the same reason.
- **Empty slots are never rendered.** Suggested matchups are adjacency-constrained, so plenty of sessions produce no upset at all; the next available honor takes the slot instead.

### The field

All players retained, compressed. `Rank · Player · W–D–L · Matches (md:) · Form (sm:) · Points`. The eight near-duplicate stat columns collapsed: Wins/Draws/Losses into one record cell, Win Rate and Rating into Points and Form.

Narrative chips ride beside the name and appear **only when true**, so a row without them reads as ordinary rather than as missing data:
- `W{n}` flame chip at a current streak of 2+
- A bolt glyph when the player has beaten stronger opposition

The Points cell carries its own breakdown on hover (`12 = 9 from results + 3 bonus`) so the number is never a black box.

The `<thead>` sticky offsets track the header stack, not the apex — the apex scrolls away above and the header sticks at the same place either way.

---

## Key States
- **Default** — apex over field.
- **Search active** — apex collapses entirely. Search puts the reader in lookup mode, not recap mode; a podium above a one-row result answers a question nobody asked.
- **Sort changed off Points** — the apex follows the active sort and labels which metric crowned it ("Leading on Form").
- **Ties at rank 1** — co-champions share the apex (`"Ada & Mira"`, or `"4-way tie"` past two) rather than one being manufactured as the winner. Runners-up are whoever is left in the top three.
- **Fewer than three ranked players** — the apex degrades to a champion and whatever runners-up exist; honors may return fewer than two.
- **No completed matches** — "No rankings yet" / "Rankings appear once matches are completed on the Dashboard".
- **Match-type filter excludes everyone** — "No matches of this type yet".
- **Search matches nobody** — "No players match your search" with a clear action.
- **No sessions at all** — "No sessions yet".

---

## Edge Cases
- **Session with only voided matches** — same as no completed matches; voided records never reach the calculation.
- **Player with only draws** — appears with points from those draws, Form at or below 0.5.
- **Player deactivated mid-session** — still appears if they have completed matches.
- **Skill level changed mid-session** — the latest level seen on a match record wins, so the badge shows current.
- **Only one session exists** — the selector shows one option and is still rendered.

---

## Export

`export-session.ts` calls the same `computeLeaderboard`, ordered by Points, so the Excel sheet and the app can never disagree. Result and bonus points are exported as separate columns alongside the total, so a reader can reconstruct it rather than trust it.
