---
target: tutorials
total_score: 32
p0_count: 0
p1_count: 1
timestamp: 2026-07-31T10-59-47Z
slug: src-components-tutorial
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Waiting state + progress label are good, but nothing restates the concrete precondition when a step is waiting — relies on the organizer having retained the body copy above it. |
| 2 | Match Between System / Real World | 4 | Copy is concrete, action-oriented, no jargon. |
| 3 | User Control and Freedom | 3 | Escape/close/skip all genuinely work now, but the callout is last in Tab order (portaled to end of `document.body`, never force-focused) — a keyboard user Tabs past the whole Dashboard once to reach it. |
| 4 | Consistency and Standards | 2 | `role="dialog"` on an element that deliberately never receives focus is a nonstandard pairing; `TutorialMenu`'s focus-restore is inconsistent with its own in-file comment (see below). |
| 5 | Error Prevention | 3 | Low-stakes surface; targets only render when their action is actually valid, so no dead-click risk. |
| 6 | Recognition Rather Than Recall | 4 | Spotlighting the real live element instead of describing it in prose is still the strongest thing about this feature. |
| 7 | Flexibility and Efficiency | 3 | Per-chapter replay via the "?" menu is genuinely efficient for a returning or second organizer. |
| 8 | Aesthetic and Minimalist Design | 4 | Small footprint, no chrome bloat, matches the "Linear/Vercel" register. |
| 9 | Help Recognize/Recover from Errors | 3 | The waiting-state fallback is a real, verified improvement over the old silent `null`. |
| 10 | Help and Documentation | 3 | `docs/specs/10-tutorial.md` and `DESIGN.md` are unusually thorough and (mostly) match the code. |
| **Total** | | **32/40** | **Good — up from 22/40 on the first pass. One real regression found against a previously-claimed fix; everything else genuinely holds.** |

#### Anti-Patterns Verdict

**No.** Clean on both counts. LLM read: no gradient text, no side-stripe borders, no glassmorphism, no eyebrows, no numbered scaffolding — restrained, consistent with the app's existing portaled-popover family (`SessionSelect`, `SkillLevelSelect`, `PlayerModal`). Deterministic scan: `node detect.mjs --json src/components/tutorial src/components/dashboard/SessionHeader.tsx src/app/page.tsx src/components/dashboard/DashboardClient.tsx` → exit 0, zero findings. No hardcoded colors or z-index values anywhere in the scanned files; all z-index usage (`--z-popover` on the menu, `--z-tooltip` on the spotlight) correctly matches the project's scale and correct relative ordering against `--z-toast`.

#### Overall Impression

This is a genuine re-critique, not a rubber stamp, and it mostly validates the fix work: **4 of the 5 originally-reported issues are cleanly fixed**, independently verified line-by-line by two separate assessments that didn't see each other's findings. The one that isn't fully fixed is specific and real: `TutorialMenu`'s item-selection path doesn't restore focus to the trigger, directly contradicting both the code's own comment and the spec doc. A second, entirely new finding surfaced this round that neither the original critique nor the audit caught: the tutorial's spotlight ring reuses the exact primary-ring color language `CourtCard` already assigns to "this needs your confirmation," creating a literal double-ring stack on the same element during an actual Substitute drag.

#### What's Working

1. **Live-element spotlighting instead of a scripted modal tour** — still the core strength. Never blocks the actual task, directly serves the "courtside, glance-and-go" principle.
2. **The `relocateEventCount` gate fix holds up under a second, independent read** — genuinely well-reasoned, correctly avoids firing a state setter inside a `setPlanningCards` updater.
3. **The waiting-state fallback's positioning is well-reasoned, not just patched in** — it explicitly clears both `BottomBar` and the toast zone, and the `TOAST_CLEARANCE` constant (116) was independently cross-checked against `Toast.tsx`'s actual `bottom-[76px]` anchor plus rendered height — it's real math, not a decorative comment.

#### Status of the 5 Previously-Reported Issues

| # | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Auto-chain walks into unreachable step | **FIXED** | `tutorial-store.ts`: `courts` (L104) precedes `swapping` (L124) in `TUTORIALS`, confirmed by both assessments. |
| 2 | Silent `null` return kills controls | **FIXED** | `TutorialSpotlight.tsx` only bails on `!mounted`; with no target, it still renders the full dialog, dashed border, waiting copy, and a working close button. Confirmed by both assessments. |
| 3 | Accessibility (Escape, ARIA, keyboard nav) | **PARTIALLY FIXED** | Escape, `aria-live="polite"`, arrow-key nav, `tabIndex={-1}` roving focus, and Escape-restores-focus are all genuinely correct and confirmed by both assessments. **But**: selecting a menu item (`TutorialMenu.tsx`, the `onClick` on each item) calls `closeMenu(false)` — skipping focus restoration — which directly contradicts the in-file comment claiming "Escape and selecting an item both restore focus to the trigger," and contradicts `docs/specs/10-tutorial.md`'s same claim. Both assessments independently found this exact discrepancy. |
| 4 | Redundant dismiss controls | **FIXED** | Every code path renders at most one "close the whole tutorial" control (header ×) plus at most one contextual action button — no path shows two buttons doing the same thing. Confirmed by both assessments. |
| 5 | Toast/z-index collision | **FIXED** | `TOAST_CLEARANCE = 116` is genuinely consumed in the flip-to-above calculation, not just asserted in a comment — independently cross-checked against `Toast.tsx`'s real footprint (`bottom-[76px]` + ~40px height ≈ 116px) by both assessments and confirmed accurate. One minor note: the same 116px constant is applied at all breakpoints, so on desktop (where the toast only needs ~64px clearance) the callout flips to "above" somewhat more eagerly than strictly necessary — conservative, never wrong, not worth fixing on its own. |

#### Priority Issues (new/remaining)

**[P1] `TutorialMenu`'s item-selection path doesn't restore focus, contradicting its own documented behavior.** `TutorialMenu.tsx`'s item `onClick` calls `closeMenu(false)` instead of `closeMenu(true)` — the one call site that most needs it, since selecting a tutorial is the entire point of opening the menu. Focus falls to `document.body` (the portaled item is removed from the DOM), and `TutorialSpotlight` deliberately never claims focus by design, so a keyboard user who picks a chapter loses focus entirely and must re-Tab from the top of the page to reach anything — including the new callout's own close button. The live-region announcement still speaks the new step's title/body, so there's *some* signal, but no way to act on it without a long re-Tab. *Fix*: change that one line to `closeMenu(true)` (or explicitly refocus the trigger before calling `onStartTutorial`), matching both the code's own comment and the spec doc — and correct the outside-click case is fine exactly as-is (that one should *not* restore focus, and doesn't).

**[P2] Courtside ring-language collision on the Substitute step — new finding, never touched by any prior fix.** `CourtCard.tsx` already uses a primary-colored ring to mean three different things (confirm-pending, valid drop target, active drag-over) — and the Substitute tutorial step's spotlight ring (`ring-primary/70`, pulsing) lands on the exact same element family (`court-player-row`), using the same hue and shape. During an actual substitute drag, the row's own `isDragOver` ring (`ring-primary/60`) and the tutorial's spotlight ring can render simultaneously on the same row — under bright gym lighting, at a glance, this reads as visual noise rather than one clean affordance, and reuses color language the organizer has already learned to associate with "this court needs a decision." *Fix*: give the tutorial ring a visually distinct treatment specifically near courts (a different hue such as `accent`, or an outline/dashed treatment) so it's never confused with an interactive-state ring on the same component.

**[P3] `role="dialog"` on an element that deliberately never receives focus.** `TutorialSpotlight.tsx`'s dialog role conventionally implies focus-on-open and discrete keyboard navigation; this component intentionally does neither (correctly, for the stated reason — not stealing focus mid-task). A screen-reader user navigating by landmark/dialog role may find it doesn't behave as the role advertises. *Fix*: `role="status"` (pairs naturally with the existing `aria-live="polite"`) would more accurately describe the actual, correct design intent.

#### Persona Red Flags

**Sam (keyboard + screen reader)**: Opens the "?" menu, arrows down to "Swapping," presses Enter. Focus vanishes to `<body>`. The `aria-live` region still announces the new step's title/body audibly, but there's no focus to act on it with — Sam has to Tab from the very top of the page to reach any control on the new callout. This is the one place the accessibility work from the last pass didn't fully land.

**Casey (distracted mobile user)**: Auto mode still works cleanly end to end for the core loop. On the Substitute step specifically, dragging a queued player onto a live court row one-handed would show two overlapping primary-colored rings flashing on the same small row — unlikely to cause a wrong action (both point at the same correct target), but reads as jitter rather than one clean signal under glare.

#### Minor Observations
- Both `docs/specs/10-tutorial.md` and `TutorialMenu.tsx`'s own in-file comment assert the item-selection focus-restore as already true — both need correcting once the P1 above is fixed (or the code needs to catch up to the docs — either way, they currently disagree with the shipped behavior).
- No runtime guard prevents `TUTORIALS` from being silently reordered back into the broken sequence from Issue 1 — worth a lightweight dev-time assertion given it already broke once.
- `CALLOUT_WIDTH` (288) + `VIEWPORT_MARGIN` (12 each side) needs 312px of viewport to avoid edge-clamping — comfortably within the app's stated 375px floor, but worth knowing if that floor ever moves.

#### Questions to Consider
- `CourtCard` already overloads `ring-primary` for three distinct meanings before the tutorial added a fourth — was this cross-checked against `CourtCard.tsx`'s existing visual vocabulary at any point during the tutorial's design, or did it ship without that comparison?
- The accessibility fix pass verified Escape and arrow-key navigation but apparently not the actual "select an item" path via keyboard — was this tested with a real keyboard walkthrough, or only against the Escape case specifically?
- Substitute is acknowledge-only because it can't be reliably gated on a real action — given that, is anchoring it to a real, ring-decorated live court row worth the collision surface it opens up, versus a static illustrated tip that never touches `CourtCard`'s own visual vocabulary at all?
