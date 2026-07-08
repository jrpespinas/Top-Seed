---
target: layout
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-06-26T05-43-52Z
slug: dashboard-layout
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Session header + court timers + ready badges solid. No scroll hint when matchup list overflows. |
| 2 | Match Between System / Real World | 3 | Domain language good. Column order runs counter to workflow — players are on the right but they're the starting point. |
| 3 | User Control and Freedom | 4 | Undo on assignment, confirm on remove/void, cancel everywhere. |
| 4 | Consistency and Standards | 3 | Uniform panel headers good. rounded-md on "New Match" vs rounded-sm on End/Void in CourtCard. |
| 5 | Error Prevention | 3 | Duplicate drop blocked, confirm on destructive actions, toggle slot-clearing. |
| 6 | Recognition Rather Than Recall | 3 | Badges reduce recall. Keyboard tab order is Courts → Matchups → Players (reverse of workflow). |
| 7 | Flexibility and Efficiency | 3 | Dual assignment paths. Primary drag direction is right-to-left which fights scan direction. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean dark palette. All three panels identical border/bg weight — eye has no anchor. |
| 9 | Error Recovery | 2 | Assignment undo only. All other destructive paths one-way after confirm. |
| 10 | Help and Documentation | 1 | "Drop a player to start" is the single hint. No Queue vs Bench explanation. |
| **Total** | | **28/40** | **Good — solid bones, layout hierarchy is the gap** |

## Anti-Patterns Verdict

**LLM assessment**: Not AI slop. Void-black + court copper identity holds. Three-panel layout is correct structural decision for real-time operator tool. What's missing is hierarchy — panels look generated as equals rather than arranged by importance. The biggest tell is gap-4 p-4 uniformity: no rhythm variation, no breathing room differentiation to signal which column matters most.

**Deterministic scan**: Exit 0, zero findings across all dashboard components and src/app/page.tsx. Clean.

## Overall Impression

The layout works. Three sticky full-height columns, crisp session header, clean panel boundaries. But all three panels look identical in visual weight. Courts is the live heartbeat of the session (timers ticking, matches ending) but it reads the same weight as planning cards. The workflow runs right-to-left (player from right → matchup center → court left) which fights Western scan direction.

## What's Working

1. **Sticky full-height columns eliminate scroll context loss** — organizer never loses court status mid-assignment.
2. **Inline court picker keeps assignment in-column** — slides in at the bottom of the matchup column, no modal, no context jump.
3. **Session header gives session pulse without competing** — h-14 strip with date, status, player count, and courts ratio is right.

## Priority Issues

**[P1] All three panels have equal visual weight — the eye has no anchor**
- What: Courts, Matchups, Players all use bg-surface border-border. Three equal rectangles.
- Why it matters: Courts is the live status column (ticking timers, End/Void controls). Should read as "NOW" vs planning area. Without hierarchy, organizer spends mental cycles deciding where to look.
- Fix: Differentiate courts. Option A: bg-surface-elevated container (one tone lighter = "active/live"). Option B: ring-1 border-primary/20 when any court IN_USE — subtle live pulse. Option C: courts header gets bg-accent/10 text-accent when matches are active.
- Suggested command: /impeccable colorize

**[P2] Column order fights the workflow direction**
- What: Courts (left) → Matchups (center) → Players (right). Workflow is Players → Matchups → Courts. Primary drag is right-to-left.
- Why it matters: Organizer's eye enters at Courts (the workflow endpoint). Every session starts with a right-to-left cognitive u-turn.
- Fix A: Reorder to Players (left, 4fr) | Matchups (center, 3fr) | Courts (right, 3fr) — left-to-right workflow.
- Fix B: Add directional visual cue between Players and Matchups headers. Keep current order.
- Suggested command: /impeccable layout

**[P2] "Suggest Match" is in the header, its output is in the center column**
- What: Suggest Match button in SessionHeader. Output (populated planning card) appears in Matchups column below. No visual connection.
- Why it matters: Organizer watches the button, not the column. Output may go unnoticed.
- Fix: Move Suggest Match to the Matchups column header, next to "+ Add."
- Suggested command: /impeccable layout

**[P2] Mobile stacking puts courts last**
- What: Mobile DOM order is Matchups → Players → Courts. Courts require significant scroll on mobile.
- Why it matters: Most common mobile use case is quick court status glance — courts should be first.
- Fix: Add order-[-1] at mobile level to the Courts mobile element to move it above Matchups on mobile.
- Suggested command: /impeccable adapt

**[P3] Mechanical gap-4 p-4 rhythm throughout**
- What: Every gap is 16px, every container padding 16px. No rhythm variation.
- Why it matters: Uniform spacing feels generated rather than designed.
- Fix: gap-5 or gap-6 between major columns. Keep inner panel padding at p-4.
- Suggested command: /impeccable layout

## Persona Red Flags

**Alex (Power User)**: Eye lands on Courts (left) but workflow starts at Players (right). Tabs through interface in reverse workflow order. Suggest Match in header means output appears somewhere else while he stares at the top bar.

**Sam (Accessibility-Dependent)**: All three h2 headings announced equally by screen reader. Tab order follows DOM (Courts → Matchups → Players) — reverse of workflow. End/Void buttons are the first interactive elements keyboard focus reaches.

**Mehmet (Traditional organizer)**: Courts on left reverses his paper whiteboard mental model (queue left, courts right). Three equal-weight panels with no visual start signal.

## Minor Observations

- SessionHeader shows activeCourts/totalCourts AND Courts panel shows total count (4). Redundant. Header count is more informative.
- CourtCard: "New Match" uses rounded-md, End/Void use rounded-sm. Inconsistent within same card.
- PlayerPoolColumn "Add" uses rounded-sm; CourtsSection "Add" uses rounded-md. Same action, different treatment.
- items-start on grid container has no visual effect since all three columns have explicit h-[calc(100vh-3.5rem)]. Dead weight.
