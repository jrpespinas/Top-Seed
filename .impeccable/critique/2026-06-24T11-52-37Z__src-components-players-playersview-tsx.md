---
target: players
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-06-24T11-52-37Z
slug: src-components-players-playersview-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Saving state + discard confirm both visible ✓; no proactive "unsaved" indicator while editing |
| 2 | Match System / Real World | 3 | Queue always labeled ✓; domain language throughout remains solid |
| 3 | User Control and Freedom | 3 | Discard guard + Escape cycling + backdrop guard all working ✓; no undo after save |
| 4 | Consistency and Standards | 3 | Cohesive; minor: "Add" vs "Add Player" mobile label still inconsistent |
| 5 | Error Prevention | 3 | Dirty drawer guard implemented ✓; name validation ✓; Add Player header button still 36px |
| 6 | Recognition Rather Than Recall | 3 | Skill label below segmented control ✓; filter chip titles ✓; Queue labeled ✓; Inactive badge always visible ✓ |
| 7 | Flexibility and Efficiency | 2 | No bulk actions, no sort controls, no keyboard shortcuts — unchanged from last run |
| 8 | Aesthetic and Minimalist Design | 3 | Count reflects view state ✓; activeCount variable now dead code |
| 9 | Error Recovery | 3 | Inline errors ✓; focus preserved on validation failure ✓ |
| 10 | Help and Documentation | 3 | Live skill label below segmented control ✓; title tooltips on filter chips ✓ |
| **Total** | | **29/40** | **Good — address remaining weak areas** |

## Anti-Patterns Verdict

**LLM assessment**: No — dark theme, domain-specific patterns, and functional density distinguish it from generic AI scaffold. Dirty-drawer guard is a real product decision. One new issue: "Keep editing" hover uses bg-border (hover background matches the border color — reads as broken).

**Deterministic scan**: Zero hits. No regressions introduced.

**Visual overlays**: Browser automation not available.

## Overall Impression

Strong improvement from 25 → 29. P1s resolved — data loss risk gone, touch targets correct, skill level legible. One overlooked touch target (Add Player header button still 36px) and no proactive unsaved-state signal are the top remaining issues.

## What's Working

1. **Dirty-drawer guard.** Full chain works: backdrop, Cancel, header X, Escape all route through handleClose. Escape-while-confirm dismisses confirm (back to editing). Correct throughout.
2. **Focus trap.** Tab cycles within drawer. Effect re-runs when isDirty changes — prevents stale closure on Escape handler.
3. **Skill legibility stack.** aria-label for SR, title tooltip on filter chips, live "C — Intermediate" below drawer segmented control.

## Priority Issues

**[P1] Add Player button in the header still at 36px touch target**
min-h-[36px] on PlayersView.tsx:116. Fix: min-h-[44px].
Suggested command: /impeccable adapt

**[P2] No proactive "unsaved" signal while editing**
isDirty tracked but invisible. Organizer has no awareness of unsaved state until close attempt.
Fix: Add `{isDirty && !discardConfirm && <span className="text-xs text-muted">· unsaved</span>}` in drawer footer near Save button.
Suggested command: /impeccable harden

**[P2] "Keep editing" button hover uses border color as background**
hover:bg-border on the Keep editing button makes the button visually disappear into the border on hover.
Fix: Change to hover:bg-surface-elevated/80 on PlayerDrawer.tsx:362.
Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User)**: Tab trap working ✓. Escape chain working ✓. Still no keyboard shortcut for Add Player; still one-at-a-time queue workflow.

**Sam (Accessibility-Dependent User)**: Focus trap working ✓. Inactive badge always visible ✓. Remaining: when discardConfirm becomes true, focus stays on triggering element — "Keep editing" (safer action) should receive focus. setTimeout(50) focus delay still racy with VoiceOver.

**Casey (Distracted Mobile User)**: Row button touch targets fixed ✓. Queue labeled ✓. Inactive badge visible ✓. Add Player header button still 36px. Mobile "Add" label ambiguous.

## Minor Observations

- activeCount (PlayersView.tsx:32) computed but unused — remove.
- PlayerDrawer.tsx has two separate `import ... from "@/lib/utils"` lines — merge.
- Mobile "Add" label split: always show "Add Player" (fits the header width).
- When discardConfirm shows, focus should move to "Keep editing" button (safer default action).

## Questions to Consider

- "Should the drawer show a · unsaved tag proactively, or is the discard-confirm guard sufficient?"
- "When active session is wired up, should Queue and inactive state be context-aware (disabled when no session open, grayed if already queued)?"
