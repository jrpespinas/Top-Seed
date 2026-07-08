---
target: matches page
total_score: 27
p0_count: 1
p1_count: 2
timestamp: 2026-07-07T23-36-52Z
slug: src-components-matches-matchesview-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live counts and toasts work; the 3s undo window has no visible countdown, and the "recorded locally" line is hidden on mobile |
| 2 | Match System / Real World | 3 | Badminton-native language throughout; undercut by first-name-only display collapsing distinctness between same-named players |
| 3 | User Control and Freedom | 2 | Two-step void confirm is good, but there's no recovery path once a voided match's undo toast lapses — voiding is quietly permanent |
| 4 | Consistency and Standards | 2 | The identical void-with-undo action has different timing, ARIA urgency, and visual chrome between this page and the Dashboard's own toast |
| 5 | Error Prevention | 3 | Confirm-before-void is solid; docked for a focus-loss issue that risks mis-taps during rapid correction passes |
| 6 | Recognition Rather Than Recall | 4 | Search-driven Win/Loss badge relabeling removes a real mental-translation step |
| 7 | Flexibility and Efficiency | 2 | No bulk void, no per-court filter, no date range — a "review many matches" page with only one-at-a-time tooling |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, token-consistent, no decorative noise |
| 9 | Error Recovery | 1 | Storage-write failures are silently swallowed; voiding excludes a match from games-played/leaderboard with no in-context warning about that consequence |
| 10 | Help and Documentation | 3 | Minimal by design, appropriate for a lightweight tool; no explanation of void's invisible side effects |
| **Total** | | **27/40** | **Acceptable — significant improvements needed, concentrated in undo/recovery and cross-page consistency** |

#### Anti-Patterns Verdict

**LLM assessment**: This does not read as generic AI slop — it shows real, deliberate design work (contextual badge relabeling, the team-chip separation from the last session, honest local-storage transparency copy). The actual tell here is subtler: **the same void-with-undo action was built twice, once per page, and never reconciled.** `MatchesView.tsx` uses a flat 3000ms toast timer and always `role="status"/aria-live="polite"`; `DashboardClient.tsx` uses 5000ms for undo-able toasts and escalates to `role="alert"/aria-live="assertive"`. Same operation, same underlying store write, different treatment depending which screen triggered it — the classic signature of features built in isolation without a cross-page consistency pass.

**Deterministic scan**: `detect.mjs` returned zero findings against both `MatchesView.tsx` and `page.tsx` — expected, since the real issues here are interaction-state and cross-file consistency problems, not markup/style patterns a static scanner catches.

**Visual overlays**: not available — no browser automation tool exists in this environment.

#### Overall Impression

The page is well-built for calm, mid-session glances — fast search, clear badges, honest empty states. It comes apart specifically under the scenario it should handle best: an organizer reviewing and correcting a long match log at the end of a session. That's where the undo/recovery gap, the dropped keyboard focus, and the cross-page toast inconsistency all concentrate. The single biggest opportunity is treating "the end-of-session correction pass" as a first-class scenario, not an afterthought of the calm-scanning design.

#### What's Working

- **Contextual badge relabeling** — searching a player switches the result badge from "which side won" to "Win/Loss relative to that player," removing a mental-translation step during exactly the workflow search exists for.
- **Team-chip separation with de-emphasized "vs"** — visually clean, and the accessible text (`aria-label` with full names) is actually *more* complete than the visual layer, an unusual but harmless inversion.
- **Honest local-recording transparency copy** — "Matches you end or void on the Dashboard will appear here" / "recorded locally" — trustworthy, no-backend-hiding language, when it's actually visible.

#### Priority Issues

**[P0] Voided matches have no recovery path once the toast is gone**
**Why it matters**: the void button only renders for `COMPLETED` matches — a `VOIDED` row never regains any action. The single-slot undo ref also means voiding a second match within the 3-second window silently forfeits the ability to undo the first, with no warning that this happened. For a page whose entire purpose is "the organizer's last chance to fix the log," this is a real data-integrity gap with silent, permanent consequences.
**Fix**: either extend the undo window and queue multiple pending undos instead of a single ref, or treat void as a real soft-delete with a persistent "Restore" action on voided rows — not just a transient toast.
**Suggested command**: `/impeccable harden`

**[P1] Focus is dropped when entering void-confirm mode**
**Why it matters**: clicking "Void" unmounts that exact button and swaps in Cancel/Confirm via conditional render — the focused element disappears from the DOM, so focus resets to the document instead of landing on either new button. Invisible to mouse users; for keyboard/screen-reader users correcting several matches in a row, every single void costs a full re-navigation from a reset focus point.
**Suggested command**: `/impeccable harden`

**[P1] Toast treatment is inconsistent with the Dashboard for the identical action**
**Why it matters**: the exact same void-with-undo operation, writing through the same store, gets a flat 3000ms timer and `aria-live="polite"` here, but 5000ms and `aria-live="assertive"` on the Dashboard. A screen-reader user voiding from this page gets less time and a weaker announcement than doing the identical action from the Dashboard.
**Suggested command**: `/impeccable harden`

**[P2] The "recorded locally" transparency line is hidden on mobile**
**Why it matters**: `hidden sm:inline` removes the one piece of copy that manages expectations about data persistence, on the device class (tablet/phone, courtside) this app is explicitly designed for first.
**Suggested command**: `/impeccable adapt`

**[P3] No batch/bulk correction tooling**
**Why it matters**: every void is one-at-a-time with no multi-select and no "void all matches on Court 3" — fine for occasional single corrections, painful if a whole round needs to be thrown out after a scoring mixup.
**Suggested command**: `/impeccable shape`

#### Persona Red Flags

**Riley (Stress Tester, end-of-session correction pass)**: Searches a common first name with two matching players in the roster — results are visually indistinguishable beyond the win/loss badge, since names are reduced to first-name-only everywhere on this page. Voids match A, then voids match B within 3 seconds — match A's undo silently vanishes with no indication this happened. Filters to "Voided" after a session with several voids — every badge reads the same generic grey "Voided," with no way to tell why each one was voided (no reason field exists on `MatchRecord` at all).

**Sam (Accessibility-Dependent)**: Hour-group headers are `aria-hidden`, so Sam gets zero indication of the temporal grouping sighted users rely on to scan — the announced list is flatter than the visual one. Tapping "Void" drops focus with no landmark to land on. The undo toast is `polite` with only a 3-second window — combined, Sam has a real risk of never hearing the undo option in time, let alone acting on it, especially compared to the same action's `assertive` treatment on the Dashboard.

#### Minor Observations

- Void-confirm button heights mismatch (`min-h-[44px]` vs `min-h-[48px]`) on adjacent Cancel/Confirm buttons — likely unintentional.
- Export button's copy says "spreadsheet" while the actual output is CSV — harmless but imprecise.
- `confirmingId` can go stale if the row being confirmed gets filtered out mid-confirmation (e.g. user starts a void, then searches) — no crash, just a dangling confirm state.
- Hour-only grouping (no date) would silently merge different days into the same bucket if the log ever outlives a single session — not a problem today, worth flagging for later.

#### Questions to Consider

- If voiding here is genuinely destructive once the toast lapses, should void become a real soft-delete with a persistent "Restore" affordance on voided rows, rather than relying on a transient undo window as the only recovery path?
- Given the roster realistically has repeated first names, should the match log show a disambiguator (last initial, skill badge) rather than defaulting to first-name-only — the same tradeoff `PlayersView` and `CourtCard` already resolved differently on the same underlying data?
- Is "scroll through the whole log" the right model for an end-of-session review, or would a "problems only" default view (voided + draws + anything unusual) turn this from a passive log into an active review checklist?
