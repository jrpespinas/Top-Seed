---
target: tutorials
total_score: 22
p0_count: 2
p1_count: 2
timestamp: 2026-07-31T05-43-29Z
slug: src-components-tutorial
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No progress indicator in auto mode (the only mode a first-timer ever sees) — `progressLabel` is manual-replay-only. A step can also vanish with zero message when its target isn't in the DOM. |
| 2 | Match Between System / Real World | 3 | Correct domain vocabulary throughout (session/queue/matchup/court/FIFO); docked because copy assumes a court already exists without ever teaching court creation. |
| 3 | User Control and Freedom | 2 | No Back in auto mode; no Escape on the spotlight dialog itself, unlike its sibling `TutorialMenu`. |
| 4 | Consistency and Standards | 2 | Visually on-token throughout, but internally inconsistent (Escape works in `TutorialMenu`, not in `TutorialSpotlight`) and regresses the codebase's own established keyboard-nav pattern for popovers (see P1 below). |
| 5 | Error Prevention | 1 | Nothing prevents the auto-chain from walking into a step whose target structurally cannot exist yet. |
| 6 | Recognition Rather Than Recall | 3 | The core concept is strong — points at the literal live element instead of describing it abstractly. |
| 7 | Flexibility and Efficiency | 3 | Gated-on-real-action auto mode plus independently-replayable chapters is a genuinely good fit for a speed-first tool. |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, fully on-token, no backdrop dimming — the best-executed part of the feature, and the detector scan backs this up with zero findings. |
| 9 | Help Recognize/Recover from Errors | 0 | Zero error or waiting state. A step with an unreachable target just silently disappears. |
| 10 | Help and Documentation | 3 | The tutorial *is* the help layer, scoped sensibly, independently replayable per chapter. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed before this is fully trustworthy for a first-time user** |

#### Anti-Patterns Verdict

**Start here. Does this look AI-generated? No.**

**LLM assessment**: Clean. No gradient text, no side-stripe borders, no glassmorphism, no uppercase-tracked eyebrows, no numbered-circle scaffolding. The component deliberately reuses the app's own existing shapes rather than inventing new ones — `animate-tutorial-in` mirrors `label-in`/`toast-in`, the ring reuses `card-suggest-pulse`'s box-shadow technique, the step counter is correctly set in JetBrains Mono per the app's own "Monospace Conviction Rule." This is a stock SaaS-onboarding-tour *pattern* (spotlight ring + anchored callout + replay menu is the Shepherd.js/driver.js/Appcues family), but it's executed with real restraint rather than generic default styling.

**Deterministic scan**: `node detect.mjs --json src/components/tutorial src/components/dashboard/SessionHeader.tsx src/app/page.tsx` → exit code 0, **zero findings**. Verified genuine (not suppressed): no `.impeccable/config.json` ignore rules exist, and a `--no-config` re-run against the same targets and against the full `src/` tree both also returned zero. This is real evidence backing the "restrained, on-token" read, not just an LLM impression — no hardcoded colors, no hardcoded z-index values anywhere in the three files scanned.

**Visual overlays**: Not available — this harness has no browser automation tool, so no live-page overlay could be generated. Judgment here rests on source reading plus the deterministic scan, not visual confirmation.

#### Overall Impression

Visually and stylistically, this is one of the better-executed features in the app — zero slop tells, zero detector findings, genuine design-token discipline, and reduced-motion handling that actually preserves the pulse's signal instead of letting the blanket rule erase it. But it has a real **structural bug**, not a polish issue: the tutorial chapters are ordered in a way that lets the auto-chain walk into a step whose target cannot exist yet, and when that happens the entire spotlight — including its own dismiss controls — silently vanishes. On a strict first-run path, this can mean a first-time organizer is never automatically taught how to assign a match to a court or that queue return is FIFO — the two most operationally important lessons in the whole system. That's the single biggest opportunity here: this needs a structural fix before it needs any more polish.

#### What's Working

1. **The gated-on-real-action design is genuinely reasoned, not just cosmetic.** `tutorial-store.ts` and `docs/specs/10-tutorial.md` both document a real bug the team caught and fixed themselves: `placed >= 2` looked like a valid gate for the Relocate step but was satisfiable by a single Suggest click, letting that lesson advance without the organizer ever relocating anyone. It was replaced with a real event counter, deliberately validated *before* the state updater rather than inside it (a state setter can't safely fire inside a `setPlanningCards` updater, which React may invoke more than once to verify purity). That's real engineering rigor in service of a design goal.
2. **Rejecting the dimming backdrop was the right call, and it's backed by an actual stated reason**, not just a preference: a full-screen scrim would block the organizer from just doing the task, defeating the entire "teach by real action" premise. This is exactly the kind of case where the more common (and more AI-slop-typical) modal-tour pattern was deliberately rejected for a reason specific to this product.
3. **The reduced-motion fallback for the pulse is done right, not just present.** `globals.css` replaces the oscillating pulse with a *held* steady ring under `prefers-reduced-motion: reduce`, rather than letting the blanket animation-collapse rule silently erase the only affordance calling attention to the target — most implementations just let that happen by accident.

#### Priority Issues

**[P0] The auto-chain can walk into a structurally unreachable step.**
*Why it matters*: `TUTORIALS` order is Getting Started → Building a Matchup → **Swapping** (Relocate, then Substitute) → **Courts** (Assign to court, FIFO return). Substitute's target (`court-player-row`) only renders inside an `IN_USE` court — which doesn't happen until the *next* chapter teaches "Assign to court." On a strict first-run path, Substitute becomes active with no reachable target, its ring never appears, and because it's the one step with no `gate` (only advanceable via a "Got it" button that never gets a chance to render), the chain simply stops. The two most operationally load-bearing lessons in the tutorial — assigning a match, understanding FIFO queue return — never auto-fire for a first-timer who follows the tutorial exactly as designed.
*Fix*: reorder `TUTORIALS` so "Courts" precedes the Substitute step, or add a real gate to Substitute that also accepts "no live match exists yet, so skip."
*Suggested command*: `/impeccable harden` (this is exactly its territory — a real edge case that breaks the primary path, not a visual issue).

**[P0] No visible state when a step's target can't be found.**
*Why it matters*: This is the general vulnerability the bug above exploits, and it isn't limited to Substitute — any step whose target is conditionally absent (e.g., "Assign to court" only exists when a card is `ready` *and* a court is available) hits the same wall. `TutorialSpotlight`'s only behavior when `measure()` returns null is `return null` (confirmed independently by both assessments, with exact line references) — the entire spotlight disappears, including its own close/skip buttons. A stuck organizer has no visible way out short of discovering the unrelated "?" icon by accident.
*Fix*: at minimum, keep the callout alive with a "waiting for you to do X" message and a working close control when the target is unreachable, instead of returning nothing.
*Suggested command*: `/impeccable harden`.

**[P1] Accessibility was visually designed but not behaviorally implemented, and it regresses the app's own established pattern.**
*Why it matters*: `TutorialSpotlight` has no Escape handler at all — its own sibling, `TutorialMenu`, correctly wires one, so this is an inconsistency within the same feature, not just a general gap. More specifically: `TutorialMenu` declares `role="menu"`/`role="menuitem"` without implementing the arrow-key navigation those roles promise to screen-reader users — and this app already has an established, correct pattern for exactly this kind of popover-list widget (`SessionSelect.tsx` and `SkillLevelSelect.tsx` both use `combobox`/`listbox`/`option` with full arrow-key handling). `TutorialMenu` is the only popover in the codebase using `role="menu"`, and the only one that doesn't implement its required keyboard behavior. Neither component moves focus into itself on open, unlike the app's own `useConfirmFocus` convention used elsewhere for exactly this kind of transition.
*Fix*: wire Escape on `TutorialSpotlight` to its close handler; either implement real arrow-key nav on `TutorialMenu` or switch it to the same combobox/listbox pattern already established elsewhere in the codebase; move focus into both surfaces on open.
*Suggested command*: `/impeccable audit` (accessibility is squarely its territory), or `/impeccable harden` if bundled with the P0 fixes above.

**[P1] Redundant dismiss controls on every gated step.**
*Why it matters*: On any auto-mode gated step, three exits render simultaneously — the header `×` ("Close tutorial"), a "Skip this" button, and a "Skip tutorial" button — and the `×` and "Skip tutorial" call the *identical* handler. That's the same choice offered twice under different labels, adding read-time under exactly the conditions (busy dashboard, organizer standing courtside) this app is built to protect against.
*Fix*: drop one of `×`/"Skip tutorial" — keep `×` for "close/abandon" and reserve the footer row for "Skip this" only.
*Suggested command*: `/impeccable distill` (this is a "strip to essence" problem, not a visual one).

**[P2] The tutorial callout can occlude an active toast's Undo affordance.**
*Why it matters*: The spotlight uses `z-[var(--z-tooltip)]` (60), which sits above `z-[var(--z-toast)]` (50) in the app's own z-index scale. Two of the tutorial's own gated steps (Assign to court, FIFO return) fire immediately *after* actions that also trigger an undo-capable toast (court assignment, match end/void) — meaning the tutorial's own design creates a real, non-hypothetical scenario where its callout renders directly over a toast's Undo button during exactly the window that button matters.
*Fix*: either lower the spotlight below `--z-toast` when a toast is visible, or reposition the callout to avoid the toast's fixed bottom-center anchor.
*Suggested command*: `/impeccable polish`.

#### Persona Red Flags

**Jordan (Confused First-Timer, follows the tutorial exactly as designed)**: Jordan starts a session, adds players, builds a matchup, and relocates a chip — all four gates fire correctly and the ring genuinely tracks them well through that point. Then "Sub someone mid-match" is supposed to appear, targeting a live court's player row — but Jordan hasn't been shown "Assign to court" yet (that's the next chapter). No court is `IN_USE`, the target doesn't exist, and the ring simply disappears. Jordan doesn't know the small `HelpCircle` icon beside "Close Session" is a rescue mechanism, because auto mode never told them it exists. Jordan finishes their first real session never automatically taught how to assign a match to a court, or that queue return is FIFO order — silently dropped, exactly the P0 above playing out end to end.

**Sam (Accessibility-Dependent, keyboard + screen reader)**: When a tutorial callout appears, nothing is announced and focus doesn't move — Sam has no signal a dialog exists until tabbing past dozens of live dashboard controls to reach the portal's position at the end of `document.body`. Once there, Escape — the reflexive dismiss key for any `role="dialog"` — does nothing, since `TutorialSpotlight` has no keydown handler. Opening the "?" menu, Sam's screen reader announces "menu, 4 items," setting the expectation of arrow-key navigation per that role's own spec — but only Tab and click work. Sam is offered a promise the implementation doesn't keep, on the one new surface in an otherwise accessibility-conscious app that regresses its own established pattern.

#### Minor Observations

- No `scrollIntoView` fallback anywhere in the tutorial system — if a target (e.g. the first placed chip, matched via `querySelector` in DOM order) sits outside the current scroll position of a scrollable panel, the ring renders at off-screen coordinates and the callout clamps to viewport edges pointing at nothing visible.
- `completedTutorialIds` is tracked but never surfaced anywhere in the "?" menu (no checkmarks for chapters already finished) — a cheap "recognition rather than recall" win left unused.
- The reduced-motion utility class is applied inconsistently within the feature itself: `TutorialSpotlight`'s ring and dialog both explicitly carry `motion-reduce:animate-none`, while `TutorialMenu`'s panel relies solely on the blanket global rule to get the same result. Not broken, just an inconsistent authoring habit within one feature.
- Finishing all 4 chapters produces total silence (`active` just becomes `null`) — for a brand whose stated personality is "every element earns its presence," ending the arc on nothing is a small missed opportunity, not a bug.

#### Questions to Consider

- Given this app's stated brand personality explicitly rejects "friendly" and "welcoming" in favor of "competitive, premium, minimalist" — does a guided product tour (however well-skinned) fit that philosophy, or would a handful of targeted, dismissible empty-state hints teach the same loop with far less mechanism and zero deadlock risk?
- The tutorial teaches Relocate and Substitute — advanced, comparatively low-frequency actions — but never teaches adding a court, which every organizer must do before "Courts" means anything at all. Was that a deliberate scope decision, or a gap that fell through?
- If "gated on real action" is the core justification for rejecting a dimming modal, what's the fallback when the real action genuinely isn't reachable yet — and should that fallback have been designed before the `TUTORIALS` array was ordered, rather than discovered after?
