---
target: live dashboard (full surface)
total_score: 27
p0_count: 2
p1_count: 2
timestamp: 2026-07-03T09-36-55Z
slug: src-components-dashboard-full-live-dashboard
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "New Match" and "Suggest" buttons are silent no-ops — look interactive, do nothing |
| 2 | Match System / Real World | 3 | Badminton-native vocabulary throughout; minor 1v1/2v2 vs Singles/Doubles split |
| 3 | User Control and Freedom | 3 | Undo on assign + SINGLES-truncation; no undo on End/Void (low-stakes, acceptable) |
| 4 | Consistency and Standards | 3 | All three panels share one shell grammar — genuinely disciplined |
| 5 | Error Prevention | 3 | Delete-while-in-use blocked, duplicate-player blocked, assign gated on "ready" |
| 6 | Recognition Rather Than Recall | 3 | Position numbers, Matched/Playing pills, badges reduce memory load well |
| 7 | Flexibility and Efficiency | 2 | Matchup-building has no non-drag path; no bulk-select in queue/bench |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, dense-but-earned, reads as a real operator tool |
| 9 | Error Recovery | 2 | Where errors surface they're clear, but two dead buttons are silent failures |
| 10 | Help and Documentation | 2 | Appropriately minimal; tooltips carry real weight |
| **Total** | | **27/40** | **Acceptable — right at the edge of Good** |

## Anti-Patterns Verdict

**LLM assessment**: Mixed. This is not template output in its interaction design — the FIFO re-queue logic, the custom off-screen drag-image ghost, the shared easing curve, and the undo-that-restores-position (not just data) are all real bespoke thinking. But the three empty states (`PlayerPoolColumn`, `MatchupColumn`, `CourtsSection`) are the identical AI-slop empty-state recipe with only the noun swapped — none differentiate by context or nudge toward a real next action, and `NoSessionState` in `page.tsx` is the single most recognizable AI empty-state template (icon-circle + h2 + p + CTA).

**Deterministic scan**: Clean — 0 findings across all 11 scoped files. Consistent with the earlier scoped critique: the detector's rule set targets classic slop patterns, not functional gaps like dead buttons, drag-only flows, or false-choice UI, which is exactly what this round's real findings are.

**Visual overlays**: Not available — no browser automation tool in this harness.

## Overall Impression

The bones are genuinely good — disciplined shell consistency, real domain modeling in the queue logic, thoughtful undo. But this pass found something the narrower critique couldn't have caught: two core interactions are broken in ways a mouse-driven review would never surface. The entire matchup-building flow (queue → planning card) is drag-only with no touch fallback, on an app explicitly meant to be used courtside on a phone or tablet. And two prominent, primary-colored buttons — "New Match" and "Suggest" — do nothing when clicked. Those aren't polish issues; they're "does the app work" issues.

## What's Working

- **FIFO re-queue logic** (`DashboardClient.tsx:25-34`): one shared `appendSortedByCheckIn` helper correctly handles batch re-entry from three different triggers (match end, bench return, undo) with a comment that actually justifies the design decision — real domain modeling, not boilerplate.
- **Shell consistency**: Players, Matchups, and Courts panels share identical header grammar, spacing rhythm, and empty-state placement — an unusually disciplined result for a 3-panel dashboard built across many incremental rounds.
- **Undo that restores position, not just data**: assignment-undo re-inserts a card at its exact original index and restores the exact removed queue entries — most undo implementations just restore a data blob; this restores place.

## Priority Issues

**[P0] The core matchup-building flow is drag-only and won't work on touch**
**Why it matters**: `PlayerRow` in `PlayerPoolColumn.tsx` only wires native `draggable`/`onDragStart`; `PlanningCard.tsx`'s `handleDrop` is the only path for a player to land in a card slot. Native HTML5 drag-and-drop doesn't fire on touchscreens without a polyfill. Given this app is explicitly meant to run courtside on a phone or tablet, the single most important interaction on the page — building a matchup — may be non-functional on the actual target device. The empty card literally says "Drop a player to fill this card" with zero alternative.
**Fix**: add a tap-to-select-then-tap-to-place fallback (the pattern already used for chip-swapping inside a card could extend here), or an "Add to card" action in the queue row's overflow.
**Suggested command**: `/impeccable adapt`

**[P0] Two primary-looking buttons are dead code**
**Why it matters**: "New Match" on every available court (`CourtCard.tsx`) has no `onClick` at all. "Suggest" in the matchup header calls `handleSuggestMatch = useCallback(() => {}, [])` — a literal no-op, enabled whenever `canSuggestMatch` is true. Both render as fully interactive, primary-colored buttons. Clicking either produces zero feedback — no toast, no error. Under time pressure courtside, a silent failure like this reads as "the app is broken," not "this feature isn't done yet."
**Fix**: either wire real behavior or visibly disable + explain ("Coming soon") until they're implemented.
**Suggested command**: `/impeccable harden`

**[P1] "Who won?" is a false choice**
**Why it matters**: Side A wins / Draw / Side B wins (`CourtCard.tsx`) all call the identical `onEndMatch?.(court.id)` — no result is threaded anywhere, contradicting the architecture's own `Match.result: SIDE_A | SIDE_B | DRAW` model. The UI performs the ritual of asking who won without ever recording the answer. This is a decision tax with no payoff, and will read as a real bug the moment anyone builds a leaderboard against this data.
**Fix**: either persist the result (even just in local state, for later wiring) or collapse the three buttons into one "End Match" action until result-tracking exists.
**Suggested command**: `/impeccable clarify`

**[P1] Mobile buries the highest-frequency live-state panel**
**Why it matters**: On mobile, DOM order stacks Players → Matchups → Courts, meaning courts (with active timers and end/void controls — the things an organizer needs most urgently) sit at the bottom of a potentially 1500-2000px scroll at full roster size. Tablet gets this right (courts pinned full-width at top); mobile doesn't — an inconsistency between the two touch breakpoints that matter most for this app's stated use case.
**Fix**: reorder or add a persistent mobile affordance (sticky mini-courts-strip, or reorder DOM to put courts first on mobile too).
**Suggested command**: `/impeccable adapt`

**[P2] No visual escalation for anomalous court state**
**Why it matters**: mock data has a 32-minute match on Court 1 sitting beside a 15-minute one on Court 2, rendered identically. For a fast-scanning organizer, "this match is running long" is exactly the kind of signal that should draw the eye first — currently nothing does.
**Fix**: a color/urgency threshold on `ElapsedTimer` past some duration.
**Suggested command**: `/impeccable colorize`

**[P3] Bench has no removal path**
**Why it matters**: bench `PlayerRow` only wires `onReturnToQueue` — there's no way to remove a benched player from the session entirely without first returning them to queue, then removing from there. A two-step workaround for what should be one action.
**Suggested command**: `/impeccable harden`

## Persona Red Flags

**Alex (Power User)**: Expects "Suggest" to actually generate a matchup for them — it's the exact kind of accelerator Alex reaches for immediately, and it does nothing. Same with "New Match": Alex will click the obviously-primary button on an available court before hunting for the real flow, hit silence, and lose trust in every other button on the page.

**Casey (Distracted Mobile User)**: This is the persona the P0 drag-only finding is built for. Casey is one-handed, courtside, trying to build a doubles matchup by dragging a player onto a card — and on a real touchscreen, that drag likely never registers at all. Casey has no idea why nothing happens; there's no error, just an unresponsive card.

**Riley (Deliberate Stress Tester)**: Riley clicks "Side A wins," then later "Draw," then "Side B wins" across different matches specifically to see if the app tracks outcomes differently — and finds it doesn't. Riley also mid-match refreshes or checks whether ending affects anything beyond the toast text, and confirms the "choice" was cosmetic the whole time.

## Minor Observations

- `handleCardMatchTypeChange`'s DOUBLES-switch-back path relies on out-of-bounds array access resolving to `undefined`/`null` rather than explicit resizing — works today, fragile.
- Skill badge "S" and the "Matched" pill share the same copper hue family and sit close together in a queue row — at a glance, two independent signals can blur into one.
- Toast positioning (`bottom-[76px] md:bottom-6`) implies a mobile bottom bar or safe-area outside the reviewed files — worth confirming it's accounted for.
- The tablet horizontal court strip has no scroll affordance (no edge fade) — with 4+ courts, off-screen ones are easy to miss.
- Three legacy files (`ActiveMatchesSection.tsx`, `QueueMatchupSection.tsx`, `QueueSection.tsx`) remain in the dashboard directory, unimported and dead — flagged in an earlier round too, still unresolved.

## Questions to Consider

- If "Who won" doesn't record a winner anywhere, why does the UI perform the ritual of asking? Is a leaderboard feature landing soon that will retroactively justify this, or has the UI gotten ahead of its own data model?
- Every round of critique and fixing this session has been reasoned about from source — has anyone actually tried filling a matchup card with a finger on a real touchscreen? That's the one flow no amount of code reading can fully verify.
