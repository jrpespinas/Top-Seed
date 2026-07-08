---
target: players page
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-07-01T05-42-35Z
slug: src-components-players-playersview-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Filter count, sort chevron, active chip highlights present; no save feedback after edit |
| 2 | Match System / Real World | 3 | "Games" column lacks context; skill filter chips require letter-code recall |
| 3 | User Control and Freedom | 3 | Clear-filter, Cancel, discard confirm, Escape work; no undo after save |
| 4 | Consistency and Standards | 2 | Skill column header not sortable while all others are; filter chips ≠ data display format |
| 5 | Error Prevention | 3 | Name validation + discard guard; no confirm for marking Inactive |
| 6 | Recognition Rather Than Recall | 2 | Skill filter chips show single letters; title tooltips invisible on touch |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcut for Add; no bulk actions; not all sort columns discoverable |
| 8 | Aesthetic and Minimalist Design | 3 | Clean progressive column hiding; filter bar dense at ~12 interactive elements |
| 9 | Error Recovery | 2 | Edits commit immediately with no undo; name validation inline is well-placed |
| 10 | Help and Documentation | 1 | Zero contextual help; no column-header tooltips; filter codes undocumented |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

LLM assessment: Not obviously AI-generated. No ban patterns. SkillBadge text label redesign shows deliberate hierarchy thinking. Progressive column hiding is a genuine responsive priority call. Lacks personality — reads as "competent default dark admin" rather than distinctly Top Seed.

Deterministic scan: Zero findings on PlayersView.tsx and PlayerDrawer.tsx.

Browser overlays: Not available — source-code analysis only.

## Overall Impression

Functionally solid. Two embarrassingly fixable issues: the Skill column header is the only non-sortable data column (logic exists, header not wired), and inactive row opacity-50 drops text contrast below WCAG AA. Fix those two and the page is genuinely good.

## What's Working

1. Progressive column hiding with correct priority order (Name → Skill → Status → Gender/Games → Notes).
2. SkillBadge text labels — "Intermediate+" legible at a glance with color coding.
3. Drawer discard guard — two-step close prevents accidental data loss; proper Escape + focus trap.

## Priority Issues

**[P1] Skill column header not sortable**
- What: The `<th>` at PlayersView.tsx:422 is a static element. sortKey "skillLevel" and SKILL_ORDER are both implemented but unreachable from the UI.
- Why: Sorting by skill is the primary roster scan for matchmaking. Currently impossible via the table header.
- Fix: Replace static `<th>` with `<SortHeader label="Skill" sortKey="skillLevel" .../>`.
- Command: /impeccable polish

**[P1] Inactive row opacity-50 fails WCAG AA contrast**
- What: opacity-50 on the full row drops text-muted from ~4.5:1 to ~2.25:1 against the dark background.
- Why: Low-vision users and bright-light phone use cannot read inactive player names.
- Fix: Apply text-muted only to the name cell; remove global opacity-50 on the row. Keep skill badge and status cell at full contrast.
- Command: /impeccable audit

**[P1] Skill filter chips require memorization — invisible on mobile**
- What: Filter chips show single letters [S][A][B][C][D][E][F]. title tooltip only works on hover; invisible on touch.
- Why: New organizers or phone users can't determine what "B" or "D" means without memorizing the code. Data column shows full text; filter chips use different vocabulary.
- Fix: Show abbreviated text labels ("Seed"/"Adv"/"Int+"/"Int"/"Beg+"/"Beg"/"New") or full labels in chips.
- Command: /impeccable clarify

**[P2] Skill picker in drawer sparse after text-label change**
- What: Drawer skill radio buttons now show only the pill badge in a min-h-[40px] button. ~80px pill in ~390px button looks unfinished.
- Fix: Add skill letter code as secondary text-xs text-muted/50 font-mono label to the right of the badge.
- Command: /impeccable polish

**[P2] "Games" column lacks context**
- What: No indication whether games are session-scoped or lifetime. Per data model, session-scoped.
- Fix: Rename to "Today" or add title="Games played this session" tooltip on the th.
- Command: /impeccable clarify

## Persona Red Flags

**Alex (Power User):** Can't sort by skill via column header. No keyboard shortcut for Add Player. No bulk actions.

**Sam (Accessibility):** opacity-50 rows fail contrast. Skill filter chips announce only letter to screen readers ("S, button, not pressed" — no context). Redundant role="row" on tr inside role="grid".

**Pat (Club Organizer):** Taps wrong skill filter chip (no visible label). No toast after save. Filter bar has no scroll affordance — gender chips hidden off-screen on 375px phone.

## Minor Observations

- role="row" on tr inside table with role="grid" is redundant — native table roles are implicit.
- Gender filter chips show "M"/"F"/"Other" text while column shows Mars/Venus icons — minor vocabulary mismatch (P3).
- Filter bar scrollbar hidden but no gradient fade / scroll hint on mobile.
- min-w-[400px] on table triggers outer page scroll at 375px — expected but worth monitoring.

## Questions to Consider

- If organizer can only see Name and Skill on mobile, is Skill the right second column or should Gender take its place for mixed-doubles planning?
- Would a saved-confirmation toast make organizers more confident, or does quick drawer-close feel fast enough?
- What if skill filters were a single dropdown instead of 7 chips — would that free room for gender icons?
