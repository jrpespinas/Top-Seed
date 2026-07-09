---
target: leaderboard page
total_score: 29
p0_count: 2
p1_count: 2
timestamp: 2026-07-08T16-43-48Z
slug: src-components-leaderboard-leaderboardview-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Row count is `hidden sm:inline` — invisible on the primary mobile viewport |
| 2 | Match Between System and Real World | 3 | "T-1" notation is invented shorthand with no visible legend |
| 3 | User Control and Freedom | 3 | No one-tap recovery from an empty result caused by a match-type pill |
| 4 | Consistency and Standards | 2 | Empty state and control sizing both diverge from DESIGN.md's own explicit rules |
| 5 | Error Prevention | 4 | computeLeaderboard's competition-ranking logic prevents false ties |
| 6 | Recognition Rather Than Recall | 3 | Mobile SessionSelect hides the "Open" badge |
| 7 | Flexibility and Efficiency | 3 | Instant client-side filtering; no shortcuts needed for this product class |
| 8 | Aesthetic and Minimalist Design | 3 | Title bar packs 4 jobs into one 56px row, tight against 375px floor |
| 9 | Error Recovery | 3 | Only the search empty-state case gets a direct recovery action |
| 10 | Help and Documentation | 2 | Tie explanation is a hover-only tooltip, invisible to touch users |
| **Total** | | **29/40** | **Acceptable — solid data logic undermined by control sizing and one reused anti-pattern** |

#### Anti-Patterns Verdict

**LLM assessment**: Mostly not AI slop — rank color ramp, font-mono data discipline, restrained accent usage, and the hand-built SessionSelect combobox all read as considered work. Exception: the empty state (icon-in-circle + heading + copy) is a verbatim instance of the pattern DESIGN.md:337 explicitly bans, and diverges from PlayersView.tsx's own compliant plain-text pattern. The prior critique of this page called this same empty state a strength — DESIGN.md's ban appears to postdate that run.

**Deterministic scan**: Clean — 0 findings across LeaderboardView.tsx, SessionSelect.tsx, leaderboard.ts.

**Visual overlays**: Not available — no browser automation tool in this harness.

#### Overall Impression

Ranking logic and the new SessionSelect combobox are both genuinely well-built. But the session-scoping pass added four new controls to an already-dense header without re-checking them against this app's own courtside/tap-target rules, and reused the exact empty-state template DESIGN.md warns against.

#### What's Working

- Default-sort reasoning is genuinely considered (defaults to Win Rate over Wins, documented in-code, fixes the prior critique's P0)
- computeLeaderboard's tie logic implements true competition ranking, refuses false splits
- SessionSelect is a real accessible combobox — portal-rendered, full keyboard nav, proper ARIA roles

#### Priority Issues

**[P0] Empty state reuses the exact pattern DESIGN.md bans.**
Why it matters: DESIGN.md:337 explicitly forbids the icon-in-circle + heading + CTA template as the most common AI tell; PlayersView.tsx already has a compliant pattern on the same app.
Fix: replace with a single muted text line + inline text-button, matching PlayersView.
Suggested command: /impeccable polish

**[P0] New controls fall below this app's own 44×44px tap-target mandate.**
Why it matters: SessionSelect trigger (h-8/32px), pills (h-7/28px), search input (h-8/32px), search-clear (no padding) all sit under DESIGN.md/PRODUCT.md's explicit floor, even under the 36px dense-UI carve-out.
Fix: raise to h-9/h-10 for trigger/input, h-9 for pills, real p-2 hit area on clear button.
Suggested command: /impeccable adapt

**[P1] Title-bar width is tight against this app's 375px minimum.**
Why it matters: heading + SessionSelect + search + padding sums to ~380-400px by hand-calculation, at or past the stated floor.
Fix: verify at 375px; let search flex instead of fixed-width, or move to filter row.
Suggested command: /impeccable adapt

**[P1] Tie notation is explained only by a hover tooltip.**
Why it matters: title tooltips don't fire on touch, the primary interaction mode here.
Fix: persistent legend, or shared rank + background tint instead of "T-" prefix.
Suggested command: /impeccable clarify

**[P2] Mobile SessionSelect hides the one cue that disambiguates live vs. archived.**
Why it matters: "Open" badge is hidden sm:inline-flex — reintroduces the ambiguity session-scoping was built to remove.
Fix: compact colored dot visible on mobile even with label hidden.
Suggested command: /impeccable polish

#### Persona Red Flags

**Casey (courtside, one-handed, phone)**: every header/filter control sits under the tap-target spec, search placeholder won't fit its mobile box, open/closed session cue disappears on this device.

**Jordan (first-timer)**: icon-circle empty state and unexplained "T-1" both read as template-or-bug moments.

**Riley (stress tester)**: tie detection works correctly (isTied), but the explanation remains touch-invisible.

#### Minor Observations

- Sort-pill row and match-type row visually read as the same kind of control; the intentional split isn't visible to the organizer
- Count badge shows post-search count with no label
- 50-session archive labeled only by date, will compound as archive fills

#### Questions to Consider

- What if the session picker were just another pill in the filter row?
- What if tied rows shared a literal rank number with a background tint instead of an invented "T-" prefix?
- What if mobile showed a compact "W-D-L" string where Wins/Draws/Losses are hidden below lg:?
