# Spec: First-Run Tutorial

## Scope
A guided, progress-gated walkthrough of the Dashboard's core live-session loop, organized into four independently replayable chapters rather than one monolithic tour. Scoped deliberately to the Dashboard only — `/players`, `/matches`, `/leaderboard`, `/sessions`, and `/settings` are largely self-explanatory tables and get no tutorial content.

**There is currently no backend** — progress is `localStorage`-backed (`src/lib/tutorial-store.ts`), a single key (`top-seed:tutorial`) storing which tutorials are completed and which step (if any) is currently active.

---

## The Four Tutorials

| Tutorial | Steps | Why grouped together |
|---|---|---|
| **Getting Started** | Start a session; Add players | Pure setup, no decisions — the only strictly linear pair. |
| **Building a Matchup** | Build a matchup (Suggest button *or* manual drag/tap, taught together) | Two different mechanisms that solve the same problem: populate a card. |
| **Courts** | Assign to court; FIFO auto-return | The two halves of a court's lifecycle — a matchup going in, players coming back out. |
| **Swapping** | Relocate a player; Substitute mid-match | One gesture family (drag/tap-select → drop on empty = move, drop on occupied = swap) that happens to work in two places — within/across matchup cards, and onto a live court. Deliberately *not* split by destination, and deliberately *not* bundled with Suggest (a single-click auto-fill action, not a drag gesture — bundling it with the swap family would conflate two unrelated skills). |

Content lives in `TUTORIALS` in `tutorial-store.ts`, not scattered across components — each step declares an `id`, a `target` (a `data-tutorial-target` value to spotlight), `title`/`body` copy, and an optional `gate`.

**Chapter order note**: Courts comes *before* Swapping deliberately, not in the order the two chapters were designed. Substitute's target (a live court's player row) doesn't exist until a matchup has been assigned to a court — a lesson Swapping itself never teaches. Auto mode walks `TUTORIALS` in array order, so with Swapping first, a strict first-run path could reach the acknowledge-only Substitute step (no gate, only dismissible once its target actually renders) before any court had ever been assigned, stalling the whole chain before it ever reached Courts — the two most operationally important lessons in the tutorial. Reordering so Courts runs first guarantees "assign to court" has already happened by the time Swapping starts, so Substitute is only ever a matter of *when* the next match starts, not *whether* the organizer was ever taught how to start one.

**Gate design note**: a gate must detect the *real* action, not a proxy that a different, earlier action can already satisfy. The Relocate step originally gated on "2+ players placed," which looked right but wasn't — Suggest can place 4 players in one click, satisfying that threshold before the organizer ever relocates anyone, letting the tutorial silently advance past the lesson unearned. Fixed by adding `TutorialLiveState.relocateEventCount`, incremented only by a genuine relocate/swap success inside `handleRelocatePlacedPlayer` in `DashboardClient.tsx` (validated against a snapshot of `planningCards` *before* the state updater runs, not inside it — a state setter can't safely fire inside a `setPlanningCards` updater, which React may invoke more than once to verify purity). The gate is now `relocateEventCount >= 1`. Any future gate should ask the same question: can an earlier, unrelated step's completion already satisfy this condition? If yes, it needs a real event counter, not a state snapshot.

---

## Two Advance Modes

- **Auto** (first-run only): each gated step advances itself the moment its `gate` predicate returns true against live session state (queue, bench, planning cards, courts, session-scoped matches) — no button to click. On completing a tutorial, auto mode cascades into the next not-yet-completed tutorial in `TUTORIALS` order. This is the *only* mode a brand-new browser ever sees automatically, kicked off once by `maybeAutoStart` the first time nothing has ever been touched.
- **Manual** (replay only, via the "?" menu beside Close Session): the same content, same spotlighted elements, but with explicit Next/Back controls instead of gate-driven auto-advance — real-action gating would be actively annoying against an already-populated session. Manual mode never cascades into the next tutorial; closing or finishing one just ends the replay.

A step without a `gate` (Substitute mid-match) is **acknowledge-only** in both modes — dismissed via a "Got it" button rather than gated on a real substitution, since that requires a spare queued player and an active match, neither guaranteed at the moment the step appears.

---

## Mechanism (`TutorialSpotlight.tsx`)

Deliberately **not** a dimming full-screen backdrop — that would block the organizer from just doing the task instead of reading the tip, which defeats the entire "gated on real action" premise. Instead:

- A pulsing ring (`border-2 border-dashed border-accent` + `.animate-tutorial-pulse` glow, both accent-colored) around the live target element, found via `document.querySelector('[data-tutorial-target="..."]')` and tracked with a `requestAnimationFrame` poll (bails out of re-rendering when the measured rect hasn't changed) — this catches scroll/resize/layout shifts from any ancestor without needing to enumerate every scrollable container individually.
- **Accent, not primary, and dashed, not solid, on purpose.** Primary-colored rings already carry three distinct real meanings elsewhere in this app: `CourtCard`'s confirm-pending ring, its drop-target/drag-over ring, and `PlayerChip`'s own drag-over ring — and more than one of those can render on the exact element a tutorial step is spotlighting at the same time (mid-relocate, or mid-substitute onto a live match), where a primary ring would read as "this needs a decision" instead of "here's a tip." Switching the ring's hue to accent (violet) and its shape to dashed means the distinction survives even for a color-vision-deficient organizer — a different shape reads as different regardless of hue perception. The callout's own border matches (`border-accent/40`) so the ring and callout read as one system; the buttons inside stay primary, since that's this app's one real "press me" color and shouldn't compete with the frame around it.
- A small anchored callout (title, body copy, controls) positioned below the target by default, flipping above when there isn't room below.
- The rest of the UI stays fully interactive underneath — nothing is trapped or disabled.
- Portaled to `document.body` (same pattern as `PlayerModal`/`AddPlayersModal`), `z-[var(--z-tooltip)]` — the highest layer in the z-scale, since it's actively directing the next action.

**Waiting state**: a step's target can be legitimately absent — its precondition just hasn't happened yet (e.g. "Assign to court" only exists once a card is `ready` *and* a court is free). The callout always renders once mounted regardless; only the ring (which needs a real measured rect to anchor to) is conditional. With no target, the callout falls back to a fixed bottom-right corner via `bottom-[calc(136px+env(safe-area-inset-bottom))] right-3 md:bottom-20 md:right-3`, clearing both the mobile `BottomBar`'s footprint and the toast viewport's reserved zone (deliberately bottom-*right*, not bottom-center, so it never sits on top of the toast either way), swaps its `border-accent/40` for a neutral `border-dashed border-border`, and adds a small italic "Waiting for the right moment" line — so the organizer always has a working close/skip control, never a component that's silently vanished.

**Toast clearance (anchored case)**: `z-tooltip` (60) sits above `z-toast` (50), so a callout anchored near the bottom of the viewport could otherwise render on top of an active toast — a real case, not a hypothetical one, since two of the tutorial's own gated steps (Assign to court, FIFO return) fire the instant an action that also raises an undo toast completes. Fixed by reserving `TOAST_CLEARANCE` (116px) as permanent headroom in the "is there room below the target" check, so the existing flip-to-above logic naturally avoids the toast's strip as a side effect — no need to track whether a toast is actually showing.

**Keyboard and screen reader behavior**: the callout carries `role="status"` + `aria-live="polite"`, not `role="dialog"` — matching `Toast.tsx`'s own established precedent for a live region that still contains an interactive control (its Undo button), rather than the focus-trap semantics `role="dialog"` implies but this component deliberately never provides. It's non-modal by design — it never moves focus on mount, since stealing focus from whatever the organizer is mid-doing (dragging, typing) every time a tip appears would be worse than the silence it replaces — so the live region announces its appearance to screen readers without an interruption instead. Escape still closes it (`onClose`) regardless of role. The close button, like every other control in the callout, carries `min-h-[36px] min-w-[36px]` — it was previously the one control in the feature without an enforced touch target, inconsistent with its own sibling `TutorialMenu`'s trigger button using the identical icon-only-close pattern correctly.

## Targeting

Elements opt in via a `data-tutorial-target` attribute rather than threading refs/callbacks through every intermediate component — spotlighting is orthogonal to what those components actually do. Where a step's target can appear multiple times at once (a placed chip, a court player row), `querySelector` naturally grabs whichever instance is first in DOM order; no per-instance selection logic needed. The "Assign to court" button only carries the attribute when it's actually enabled (`ready` + an available court) — never spotlights a disabled control.

## Replay Entry Point (`TutorialMenu.tsx`)

A "?" icon beside Close Session in `SessionHeader` — chosen over a persistent nav icon (which would crowd the already-tight Sidebar/BottomBar secondary group) and over living in Settings (which requires navigating away from the exact content it explains). Always visible whenever a session is live, matching PRODUCT.md's "occasionally a small group sharing a device" scenario — a returning or second organizer can jump straight to just the chapter they need.

**Keyboard behavior**: real APG menu semantics, not just the `role="menu"`/`role="menuitem"` markup. The panel is portaled to the end of `document.body`, so without explicit focus management, Tab from the trigger would walk every other focusable element on the Dashboard before ever reaching it — this codebase's other portaled popover, `SessionSelect.tsx`, sidesteps that entirely by keeping real focus on the trigger and never moving it into the portal at all. `TutorialMenu` instead moves focus into the first item on open (each item is `tabIndex={-1}`, reachable only by explicit `.focus()` calls, not by Tab), handles `ArrowDown`/`ArrowUp`/`Home`/`End` to roam between items, and restores focus to the trigger button on Escape or on selecting an item — matching this app's established confirm-swap focus convention (`useConfirmFocus`) used elsewhere for the same kind of transition. An outside click still closes without forcing focus back, since the organizer clicked somewhere else on purpose.

---

## Known Gaps
- No i18n — all copy is hardcoded English strings in `tutorial-store.ts`.
- No analytics/completion tracking beyond the local `completedTutorialIds` flag — no way for an organizer (or anyone) to know whether tutorial content is actually landing.
