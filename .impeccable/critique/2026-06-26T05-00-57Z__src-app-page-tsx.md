---
target: dashboard matchups and waitlist
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-26T05-00-57Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Ready animation + undo toast + Playing/Matched badges solid. pairsExhausted never surfaced. No API loading states |
| 2 | Match System / Real World | 3 | Domain language tight. "Void" is jargon; "Bench" vs "Queue" distinction invisible |
| 3 | User Control and Freedom | 4 | Undo on assignment, confirm on remove/void, dismiss on all cards. Match type toggle immediately reversible |
| 4 | Consistency and Standards | 3 | Icon library consistent. Add button radius diverges between columns. Min-height diverges (36px vs 44px) across action buttons |
| 5 | Error Prevention | 3 | In-use courts block drops, confirm dialogs on destructive actions. Gap: same player can slot into two planning cards silently |
| 6 | Recognition Rather Than Recall | 3 | Matched/Playing badges surface state. No drag-affordance tooltip. Grip discoverability relies on hover |
| 7 | Flexibility and Efficiency | 3 | Two paths to assignment. Grip opacity fixed. No keyboard shortcuts, no auto-fill |
| 8 | Aesthetic and Minimalist Design | 3 | Void-black + copper is distinctive. QUEUE/BENCH uppercase tracking is eyebrow pattern at low frequency |
| 9 | Error Recovery | 2 | Assignment undo (5s) is only recovery path. Card dismiss, queue removal, slot-type changes have no undo |
| 10 | Help and Documentation | 1 | "Drop a player to start" is the lone clue. No help layer, no "Void" explanation, no drag hints |
| **Total** | | **28/40** | **Good — solid foundation, sharp gaps in recovery and help** |

## Anti-Patterns Verdict

**LLM assessment**: Not AI slop. Void-black background + court copper primary breaks from every dashboard reflex. Density is earned — reads as operator software. QUEUE/BENCH section labels use uppercase tracking at 10px — technically the eyebrow, but functional sectioning within a scrolling list, not reflexive. The 1v1/2v2 toggle lacks a shared visual container (no background pill on the group) — states look like separate labels rather than a segmented control.

**Deterministic scan**: Clean — exit code 0, zero findings across all dashboard components and the page entrypoint.

## Overall Impression

The 3-column layout is a significant upgrade. Courts-left, matchups-center, players-right matches workflow order. The drag model is coherent. The dark theme and copper accent give specific, non-generic identity. The sharp drop-off is in recovery and help: outside assignment undo, every destructive action is a one-way door.

## What's Working

1. **State visibility throughout the pipeline** — player pool signals three states (numbered queue, in-match, slotted) without navigation. Elapsed timer on courts closes the loop.
2. **Dual assignment paths** — dragging a card to a court and using Assign button + court picker are equivalent. In-use courts correctly block drops in both paths.
3. **Copper-on-void-black visual identity** — specific, warm, not "dark SaaS." Copper appears only on active/primary elements.

## Priority Issues

**[P1] Queue vs Bench semantics are unexplained**
- What: Two sections in the player pool with no explanation of the distinction. Both appear as available, unmatched players.
- Why it matters: New organizers won't know which group is next up. Wrong mental models lead to wrong matchups.
- Fix: Add tooltip/inline label on section headers: "Queue — waiting in arrival order" / "Bench — available, not queued." Or merge under "Available" with position number as the differentiator.
- Suggested command: /impeccable clarify

**[P1] Match type toggle has invisible data consequences**
- What: Switching 2v2 → 1v1 hides sideA[1]/sideB[1] from the UI but retains them in state. Assigning in 1v1 mode while ghost players exist creates data integrity risk.
- Why it matters: Organizer sees 2 players and feels complete; state has 4.
- Fix: Show confirmation on slot-reducing change, or visibly cross through hidden slots.
- Suggested command: /impeccable harden

**[P2] Duplicate player drops are silent**
- What: Same player can be dragged into two planning cards simultaneously. "Matched" badge updates to latest, but earlier card still holds the player.
- Why it matters: Creates impossible matchup — same player on two courts simultaneously.
- Fix: Check player presence in all cards before accepting a drop. Reject or ask to move.
- Suggested command: /impeccable harden

**[P2] "Void" button label is opaque jargon**
- What: CourtCard's secondary destructive action is labeled "Void."
- Why it matters: Organizers won't recognize the term; may confuse with "End."
- Fix: Rename to "Cancel match." Update confirmation copy accordingly.
- Suggested command: /impeccable clarify

**[P2] 5-second undo window may be too short for live sessions**
- What: Assignment undo toast auto-dismisses in 5 seconds.
- Why it matters: Organizer is talking to players, marking boards. May glance back at 6+ seconds.
- Fix: Extend to 8 seconds for assignment undo specifically.
- Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User)**: No auto-fill shortcut. Starting a session requires 16+ interactions. No keyboard shortcuts for primary actions.

**Sam (Accessibility-Dependent)**: Draggable rows have no aria-description. 5-second undo window may not give screen reader users enough time to navigate to and activate Undo.

**Mehmet (Paper-Based Organizer)**: "Bench" and "Void" don't match his vocabulary. 3-click assignment feels slow vs verbal workflow.

## Minor Observations

- 1v1/2v2 toggle needs a segmented control container (shared background pill)
- Bench players have no remove action
- "3g" games format is cryptic
- Re-suggest button (disabled, "coming soon") adds noise — hide until ready
- Planning card footer dead space when only Assign button is present (justify-between with one child)
