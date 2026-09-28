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
Primary sort key → Form → matches played → **check-in time** → name.

**Ranks are sequential throughout — 1, 2, 3, 4 — never shared places.** Competition ranking was here first (1, 2, 2, 4, with a `T-` prefix on the joint rows), on the reasoning that manufacturing a split between statistically identical records is a small lie. It was replaced because the cost landed on every reader instead: a column that is mostly plain numbers and occasionally `T-3` makes people stop and decode rather than scan, and that prefix now also reaches a printed sheet posted to people with no way to ask what it means.

**Check-in time is the final tiebreak, earliest first.** Sequential ranks mean two identical records still have to be ordered somehow, and of the available answers this is the only one that rewards something the player actually did: turning up first and playing all night beats an alphabetical accident, and it quietly encourages the behaviour an organiser wants. Name only separates two identical check-ins.

It isn't derivable from the match log — `MatchRecord` embeds bare `Player` objects while check-in lives on the queue or bench *entry* wrapping them — so `computeLeaderboard` takes an optional `checkInByPlayer` map, supplied by `useSessionCheckIns` (which branches on open session vs. frozen snapshot). `LeaderboardRow.checkInAt` falls back to the player's **first match** when the map has no entry, which is why it is never null: a row exists only because that player appeared in a completed match. Snapshots predating `sessionJoinedAt` rely on that fallback.

### Sorts
`points` (default) · `form` · `wins` · `matchesPlayed`. Match-type filter: Singles / Doubles / Combined.

---

## Derived stats

All computed in `src/lib/leaderboard.ts` from the existing match log, all covered by `leaderboard.test.ts`.

| Stat | Rule |
|---|---|
| `currentStreak` | Consecutive wins ending at the most recent match. A draw breaks it. |
| `longestStreak` | Longest such run in the session. Surfaced as a row chip and the **On Fire** award only from **3**: two consecutive wins happens constantly in a session of four-match evenings, so a chip on half the field says nothing about any of them. |
| `bestUpset` | The single win that earned the most bonus, with opponent names. |
| `bestPartner` | Most wins alongside one partner, **minimum two matches together**. |
| `carryWins` / `carryRungs` | Wins where the partner sat below this player on the ladder, and the rungs carried. |
| `timeOnCourtMs` | Σ of `endedAt − startedAt` over completed matches. |
| `checkInAt` | Session check-in, or the first match played. Never null. |

Matches are sorted chronologically before any of this runs — the match log hands records back newest-first, and a streak read in that order would be the reverse of what happened.

**Head-to-head was specced and deliberately not built.** Nothing in the design displays it, and an untriggerable code path is the same problem as the unimplemented `isWalkover` branch.

---

## Layout — `/leaderboard`

### The apex

Three to six players recognised in one composition, with the first holding the centre — more when the awards fall outside the podium, fewer when the podium earned them. Three tiers, each a visibly different object rather than the same card at three sizes:

1. **Champion** — filled brand blue, largest, centre column on desktop and full width on mobile. Carries the rank numeral, name, points, record, form, and one generated sentence (`championSummary`) assembled from what actually happened. Returns `null` rather than filler when nothing specific is true; an empty line reads better than "had a good session".
2. **Runners-up** — outlined in the same blue, roughly a third of the champion's presence, flanking it at `md:` and paired beneath on mobile.
3. **Awards** — neutral, quietest. Podium winners wear theirs as a tag on their own card; only non-podium winners get a card here. An award recognises a moment, not a placing.

**Places 1–2–3 show medals (🥇 🥈 🥉) in place of their numerals**, on the podium cards, in the field table and on the export sheet (shared via `medals.tsx`). Frames and fills still never go gold, silver or bronze. `SkillBadge` runs Bronze → Platinum for Casual → Advanced inside these same slots, so a gold *frame* would read as a tier. An emoji medal reads as placing. Ranks 4 and down keep plain numerals. Each medal carries `role="img"` with a spoken place ("1st place"), because emoji names are announced inconsistently.

**Awards share one ⭐ emblem** in place of the earlier per-kind icons, so special awards read as their own family, separate from the podium's medals.

### Awards (`selectHonors`)

Five named awards. Each has a floor it must clear, so trivia can't take a slot — one win is not a run of form, one match is not an endurance record.

| Kind | Name | Measures | Floor |
|---|---|---|---|
| `upset` | **Giant Killer** | Best single win over stronger opposition | 1 |
| `streak` | **On Fire** | Longest run of consecutive wins | 3 |
| `carry` | **The Carry** | Wins alongside a weaker partner | 2 |
| `onCourt` | **The Android** | Matches played, win or loss | 2 |
| `pair` | **The Duo** | Most wins with one partner | 2 |

**The Carry is deliberately not gated on being the underdog**, unlike the points bonus. The points gate exists so an easy win can't be paid twice; this award asks a plainer question — did you win with someone below you on the ladder? — and beating a weak pair while carrying a weak partner is still carrying.

#### Ranked by how unusual it is, not by a fixed order

```
standout = leader's value / max(1, runner-up's value)
```

The first version walked a hardcoded priority list — upset, then streak, then matches — which meant **a one-rung upset always outranked a six-match winning streak purely because of list position.** That is backwards.

`standout` asks the same question of every award regardless of its units: *how far clear of the next person is this?* A 3-rung upset nobody else managed scores 3.0; a 6-match streak where the next best is 3 scores 2.0; the busiest player at 9 matches with someone else on 8 scores 1.1. Dimensionless, so streaks and upsets and match counts compare directly — the same relative reasoning as the long-match marker on the Matches page. Ties fall back to the old priority order.

Up to **three** awards are computed. Five candidate kinds made two too few: the deepest ones were permanently unreachable.

#### Where an award is displayed

- **A podium winner wears theirs as a tag on their own card.** The podium card is where that person is already being recognised; a second card carrying the same name reads as a duplicate rather than a second honour.
- **Only awards won from outside the top three become separate cards**, and when there are none the strip is not rendered at all rather than left as an empty row.
- **One award per player.** Two adjacent tags or cards on one name looks like a rendering fault.
- **The podium is eligible.** These were once excluded, on the reasoning that a 5–0 champion owns the longest streak by construction, so awarding it to them recognises four people where the layout has room for five. That was reversed: handing "longest streak" to the second-longest run in the room while the actual holder stands on the podium is a worse thing to print than a shorter list.
- **The champion's summary line suppresses whatever their own tag says** — `championSummary(row, { suppressUpset, suppressStreak })`. `suppressStreak` covers "Won all N" too, not just the obviously streak-shaped clause: "Won all N" requires zero losses and zero draws, so the record and the longest streak are the same number. Beside a tag reading "5 wins in a row" it is the identical fact in different words. With everything suppressed the line goes silent rather than inventing filler; the tag is saying it instead.

### The crowning

The champion card's entrance, and the app's only one.

A white sheet over the blue ground retreats to the right, so the card begins as a runner-up and the brand colour arrives. Runners-up rise with it; the champion's content fades in behind the sheet so near-white text never sits on near-white ground.

**It fires only when the set of rank-1 players changes**, tracked per session under `topseed:crowned:<sessionId>` in `localStorage` and read in an effect rather than during render (touching storage while rendering desyncs server and client markup). Tied champions are keyed as a sorted join, so a shared first place counts as one champion — the lead has changed only when the *set* changes. Storage access is wrapped: it throws in some privacy modes, and the right fallback there is no animation at all.

Two invariants, both load-bearing:

- **No `animation-fill-mode`.** The sheet's resting clip-path is fully retreated, so an unplayed animation leaves a finished card, never a blank one.
- **Holds live in keyframes, not `animation-delay`.** A delay without fill-mode renders the resting state and then snaps to the 0% frame — a visible flash.

`prefers-reduced-motion` removes the animations entirely (`motion-reduce:animate-none`), which lands on the same finished card by the same resting-state rule.

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
