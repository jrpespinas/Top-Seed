---
target: leaderboard
total_score: 27
p0_count: 1
p1_count: 2
timestamp: 2026-07-08T02-51-45Z
slug: src-components-leaderboard-leaderboardview-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Row count and pill states give clear current-state feedback; no issues found |
| 2 | Match System / Real World | 3 | Badminton-appropriate vocabulary, but "Matches" (column) vs. "Matches Played" (sort pill) label the same concept two different ways on one screen |
| 3 | User Control and Freedom | 2 | No "Clear"/reset-to-default control anywhere, despite three independent filter dimensions — both reference pages (Players, Matches) have exactly this |
| 4 | Consistency and Standards | 2 | Sort lives in a separate pill row while the table's `<th>` elements look clickable (same styling as PlayersView's real sortable headers) but do nothing |
| 5 | Error Prevention | 3 | Nothing destructive on this read-only page; the one soft issue is an empty-state title that over-attributes cause |
| 6 | Recognition Rather Than Recall | 2 | The value driving the default sort (Wins) is invisible below `lg:` — recognition of *why* the order is what it is fails exactly where it matters most |
| 7 | Flexibility and Efficiency | 2 | No search/jump-to-player, no click-to-sort column shortcut |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely clean, no unnecessary chrome, disciplined numeric typography |
| 9 | Error Recovery | 3 | No error states to diagnose; empty states handled, if imprecisely titled in the filtered case |
| 10 | Help and Documentation | 3 | Appropriately light-touch; no microcopy explaining "Draws" to a first-time organizer |
| **Total** | | **27/40** | **Acceptable — the core defect concentrates in one place: the default sort's driving number is invisible on the device this app targets first** |

#### Anti-Patterns Verdict

**LLM assessment**: This does not read as AI slop, and the restraint looks genuine. No medal emoji, no gradient rank badges, no fake podium layout, no decorative trophy riding on every row — the single `Trophy` icon appears once, in the empty state, sized and colored like any other icon in this app. Rank differentiation is handled entirely through typographic weight (bold + `text-primary` for #1, tapering for #2-3), which is a defensible way to signal "podium" without literally drawing one.

One specific thing worth verifying rather than assuming: the sticky `<thead>`'s `top-[154px]` pixel offset (flagged in the build as a recalculated, non-guessed value). I had it independently re-derived by hand from the actual header stack in the JSX rather than trusting the code comment — **the arithmetic checks out**: title bar (56px, `h-14`, border absorbed by `box-sizing: border-box`) + sort row (49px: 28px pill + 20px padding + 1px border) + filter row (49px, same) = 154px exactly, and this mirrors `PlayersView.tsx`'s working `top-[109px]` (56px + 53px) derived the same way. The number is correct today — the underlying pattern (three magic numbers across two files that silently desync if anyone changes a `py-*` or pill height without updating the other) is a structural fragility worth naming, not a live bug.

**Deterministic scan**: `detect.mjs` returned zero findings — expected, since the real issues here are about responsive information hierarchy and interaction-model consistency, not markup patterns a static scanner catches.

**Visual overlays**: not available — no browser automation in this environment.

#### Overall Impression

This is a carefully built page that clearly absorbed the app's existing visual language rather than reinventing one — the restraint, the typography discipline, and the correct (if fragile) sticky-header math all point to real craft. But there's one load-bearing defect: the default sort order is driven by a number (Wins) that's hidden on phones, which is explicitly this app's first-priority device. A courtside organizer glancing at this on a phone will see an order that visibly contradicts the one number they *can* see (Win Rate), and that will read as "broken," not "restrained."

#### What's Working

- **The sticky-header pixel math is correct** and follows an established, already-working convention from `PlayersView.tsx` — the kind of detail that's easy to get subtly wrong, and wasn't.
- **Responsive column-hiding correctly protects the "glance" columns** (Rank/Player/Win Rate always visible) — the right instinct for a courtside device, even though the specific default-sort choice undermines it (see P0).
- **Genuine restraint in the empty and rank-1 states** — no gamification clichés, sensible copy that names the actual mechanism (the Dashboard) instead of a generic "no data" placeholder.

#### Priority Issues

**[P0] Default sort criterion is invisible on the primary target device**
**Why it matters**: default sort is Wins, but the Wins column is `hidden lg:table-cell` — invisible below 1024px, i.e. on virtually every phone and portrait tablet, this app's stated first-priority form factor. The visible order will visibly contradict Win Rate ordering (a 100%-win-rate player from 3 matches can rank below a 67%-win-rate player from 12), reading as broken to exactly the audience this app targets first.
**Fix**: either default-sort by a column that's always visible (Win Rate), or make the responsive column strategy follow whichever column is currently driving the sort rather than a fixed breakpoint ladder.
**Suggested command**: `/impeccable harden`

**[P1] No way to find yourself in a long list**
**Why it matters**: neither a name search nor a "scroll to me" affordance exists, unlike both reference pages (Players, Matches) which have search inputs for a strictly simpler filter set. "Check my own standing" is the single most common reason to open this page; at 50+ players with no pagination, that degrades into manual scrolling.
**Suggested command**: `/impeccable harden`

**[P1] Ties are rendered as false precision**
**Why it matters**: rank is assigned as strict sequential position (`i + 1`) even to statistically-identical rows. The tiebreak (matches played) can itself tie, with no third-level tiebreak or "T-" notation — given the PRD explicitly specifies a tiebreak rule (implying ties are expected in small player pools), presenting confidently-distinct rank numbers for identical records misrepresents the data.
**Suggested command**: `/impeccable clarify`

**[P2] Sort interaction model is inconsistent with the app's own established pattern**
**Why it matters**: `PlayersView` sorts via clickable, `aria-sort`-annotated `<th>` headers. Leaderboard uses a separate pill row while its `<th>` elements are styled identically to Players' real sortable headers but do nothing on click — a "looks interactive, isn't" trap for anyone who used Players first.
**Suggested command**: `/impeccable harden`

**[P2] Draws column deviates from PRD's explicit column list, and there's no reset control**
**Why it matters**: `docs/PRD.md` lists exactly Rank/Player/Matches Played/Wins/Losses/Win Rate — Draws isn't in that list (a deliberate addition from this session's own shape discovery, worth a conscious note rather than silent drift). Separately, unlike both reference pages, there's no "Clear"/reset-to-default link once any of the three filters change.
**Suggested command**: `/impeccable clarify`

#### Persona Red Flags

**Casey (Distracted Mobile User)**: opens the app one-handed mid-session, glances at Leaderboard. Sees Rank/Player/Win Rate only — the default Wins-driven order looks arbitrary relative to the one number Casey can actually see. If Casey's group has 20+ players and is trying to find their own name one-handed before a court frees up, there's no search — just scrolling.

**Riley (Stress Tester)**: produces two players with identical wins/draws/losses/matches (trivial — have the same two players split two double-headers 1-1) and gets distinct, confidently-numbered ranks with zero on-screen justification. Filters to a match type nobody has played (e.g. Singles when only Doubles has been recorded) — gets an empty state titled "No matches in this range," which misdirects the cause toward date range when it's actually match type. A session with exactly one match ever recorded works correctly — clean 100%/0% win rate, no crash, no NaN.

#### Minor Observations

- `role="grid"` is used on a table with zero interactive cells and no arrow-key navigation implemented — this page is explicitly PRD-mandated read-only, so a plain `<table>`/`role="table"` would be the more honest semantic (more so than in `PlayersView`, where rows genuinely are clickable).
- Row hover state exists on fully non-interactive rows with no `cursor-pointer`/`tabIndex`/`onClick` — worth confirming it's not implying clickability it doesn't have.
- "Matches" (table header) vs. "Matches Played" (sort pill label) name the same value two different ways on the same screen.
- No "Today" date-range option (only This Week / This Month / All Time) — matches PRD exactly, so not a defect against spec, but worth flagging given the "who's hot today" mid-session use case isn't well served by any current option.

#### Questions to Consider

- If "check who's winning" is a one-glance courtside task, does this page need three full rows of always-visible filter chrome — or would collapsing Sort/Filters behind a single toggle (defaulting closed) let the table start closer to the fold, since the defaults already answer the common case?
- Given the PRD's own tiebreak rule implies ties will happen in small player pools, should tied players ever share a displayed rank (a "T-" prefix) rather than a manufactured, confident split?
- Should the responsive column strategy be built around whichever column is currently driving the sort, rather than a fixed breakpoint ladder ported from `PlayersView`'s unrelated column set?
