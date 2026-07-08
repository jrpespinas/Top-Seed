---
target: src/app/page.tsx
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-26T04-12-16Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Header stats + card border states + toast. Silent when card reaches "ready" state |
| 2 | Match System / Real World | 3/4 | Domain language tight. Minor: 1v1/2v2 toggle assumes format knowledge; no court surface context |
| 3 | User Control and Freedom | 4/4 | Strong: dismiss, remove, swap, cancel all present. Queue reorder always reversible |
| 4 | Consistency and Standards | 3/4 | Icon system consistent. Gap: min-h-[44px] inconsistent on secondary buttons; confirm pattern (Check/X) used only in some places |
| 5 | Error Prevention | 2/4 | Full card can be dragged to in-use court. Auto-creates empty card on assign without confirmation |
| 6 | Recognition Rather Than Recall | 3/4 | Icons + labels on nav. Border-state system undocumented. Next-slot highlight non-obvious until first use |
| 7 | Flexibility and Efficiency | 3/4 | DnD is best accelerator. No keyboard shortcuts. No bulk assign. Grip handle too faint to discover |
| 8 | Aesthetic and Minimalist Design | 4/4 | Clean, purposeful dark theme. Copper accent restrained. Three border opacity levels create faint noise |
| 9 | Error Recovery | 2/4 | Assign is irreversible — card deleted, court marked IN_USE, no history. No undo. Dismiss card has no undo |
| 10 | Help and Documentation | 1/4 | Minimal: empty card hint only. No drag affordance explanation, no skill legend, no onboarding |
| **Total** | | **28/40** | **Good — address weak areas** |

## Anti-Patterns Verdict

**LLM**: Not AI-generic. OKLCH palette intentional, domain language specific, drag-swap bespoke. Light tell: uppercase tracked sub-list section labels (QUEUE/BENCH) trend toward eyebrow pattern — P3, not a full violation. Dark theme earns its place (organizer at sports hall, fluorescent ambient).

**Detector**: Zero findings ([]). No gradient text, side-stripe borders, or hero metrics detected.

**Browser visualization**: Not available.

## Priority Issues

**[P1] No undo on court assignment, no reassign path**
- When a card is assigned to a court, it's deleted from planning view and the court is marked IN_USE. No undo, no history, no "Unassign" button. Recovery requires manually ending the phantom match and rebuilding the card from scratch.
- Fix: Add Unassign option in CourtCard footer. Or show a 5s undo toast after assignment. Or keep assigned card in dimmed "Assigned" state in MatchupColumn.
- Suggested command: /impeccable polish

**[P1] Tablet layout hides courts — breaks primary drag workflow**
- Courts hidden at md: breakpoint (768-1023px), covering all iPad portrait layouts. Organizer loses court context; drag-to-court impossible; forced to use slower Assign-button flow.
- Fix: Show courts as horizontal row above 2-col grid on tablet, or as collapsible panel. The md:hidden lg:block approach is too aggressive.
- Suggested command: /impeccable adapt

**[P1] Hover-based controls invisible on touch devices**
- Queue reorder (up/down) and remove X appear only on group-hover:opacity-100. Touch devices have no hover state. Controls literally don't exist for iPad/phone users.
- Fix: On touch, show controls always-visible (not opacity-0), or use swipe-to-reveal, or tap-to-expand per row. At minimum, remove X should always be tappable.
- Suggested command: /impeccable adapt

**[P2] Card becomes "ready" silently**
- When all 4 slots of a doubles card are filled, border changes to primary/40 and "Ready" label appears — both subtle. Organizer may not notice and try to drop a 5th player, which fails silently.
- Fix: Brief check icon flash or pulse on Assign button when card transitions to ready. transition-colors duration-300 on the border alone would help.
- Suggested command: /impeccable polish

**[P2] Drag handle opacity too low to discover**
- GripVertical renders at text-muted/30 — nearly invisible on dark bg. First-time users won't know cards are draggable. cursor-grab only activates on hover, which requires prior discovery.
- Fix: Increase handle opacity to text-muted/60 at rest, text-muted on hover. Or make cards draggable from header area, not just the handle.
- Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User, desktop):**
- Assigns card to wrong court. No undo. Must end match and rebuild card manually.
- Has 5 ready cards, 5 open courts. Must assign one-at-a-time. No bulk path.
- RefreshCw (re-suggest) is disabled with no ETA or explanation.

**Casey (Distracted Organizer, iPad courtside):**
- iPad portrait → courts invisible. Spatial disorientation: "where are my courts?"
- Queue reorder/remove controls don't exist on touch (hover-only).
- Skill badge "F" has no legend — doesn't know if best or worst.

## Minor Observations

- QUEUE/BENCH uppercase labels in PlayerPoolColumn trend eyebrow-antipattern. Sentence case + divider would be cleaner.
- `isDraggingPlayer` state set in DashboardClient but value never read. Dead code.
- Swords icon for Matchups is the most personality-forward choice in the app. Good energy — use more.
- CourtCard "New Match" button has no handler. Should be disabled or wired up.
- Bench players have no Remove affordance (onRemove not passed).

## Questions to Consider

- An organizer assigns a matchup to the wrong court — what should recovery feel like? Undo toast, or always-visible Unassign on the court?
- On iPad at a sports hall, the organizer is 3 meters from the screen half the time. Should courts be visible on tablet, or should assignment be button-only?
- Cards draggable from anywhere in header area vs. only the grip handle — which feels more natural?
