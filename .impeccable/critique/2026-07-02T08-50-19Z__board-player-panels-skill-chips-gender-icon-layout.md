---
target: "live dashboard player panels: skill chips, gender icon, layout"
total_score: 15
p0_count: 0
p1_count: 1
timestamp: 2026-07-02T08-50-19Z
slug: board-player-panels-skill-chips-gender-icon-layout
---
## Design Health Score

*Scoped critique — only heuristics observable in the skill chip / gender icon / player row surface are scored. 4 of 10 are n/a at this narrow a scope; scoring them anyway would be dishonest.*

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Games-played, Playing/Matched pills read clearly |
| 2 | Match System / Real World | 3 | Badminton-appropriate skill labels; Mars/Venus is a common but not universal convention |
| 3 | User Control and Freedom | n/a | Out of scope for chip/icon/layout |
| 4 | Consistency and Standards | 2 | Skill+gender position and gender-icon size differ by panel |
| 5 | Error Prevention | 2 | Beg vs Beg+ near-identical at a glance |
| 6 | Recognition Rather Than Recall | 2 | SkillBadge has no visible tooltip (aria-label only); GenderIcon does — inconsistent even within scope |
| 7 | Flexibility and Efficiency | n/a | Out of scope |
| 8 | Aesthetic and Minimalist Design | 3 | Dense but the info earns its place for this workflow |
| 9 | Error Recovery | n/a | Out of scope |
| 10 | Help and Documentation | n/a | Out of scope |
| **Scoped Total** | | **15/24** | Applicable heuristics only — Acceptable band |

## Anti-Patterns Verdict

**LLM assessment**: Mixed, leaning "no." This is not generic AI slop — the OKLCH token system fades copper/slate intensity across skill tiers deliberately, and the micro-typography (`text-[10px]`, `tabular-nums`, `font-mono`) is hand-tuned, not stock Tailwind defaults. What does smell unfinished: `SkillBadge.tsx` gives D, E, F three byte-identical class strings (`bg-ink/6 text-muted`), like a variants map scaffolded and never finished, and the 11px Mars/Venus glyph size reads as a first-idea choice that was never pressure-tested for legibility.

**Deterministic scan**: Clean — 0 findings across `PlayerPoolColumn.tsx`, `PlanningCard.tsx`, `CourtCard.tsx`, `SkillBadge.tsx`, `GenderIcon.tsx`. This isn't contradictory to the LLM findings — the detector's rule set targets classic slop patterns (gradient text, side-stripe borders, eyebrow scaffolding), not cross-file layout consistency or icon-legibility-at-size, which is exactly what Assessment A caught and the detector structurally can't.

**Visual overlays**: Not available. No browser automation tool is present in this harness, so live in-page injection was skipped per the fallback protocol; findings below rest on source inspection only.

## Overall Impression

The design system underneath this is genuinely considered — real OKLCH opacity-fade logic, careful touch targets, consistent focus rings. But the three panels that render this exact same data (name + skill + gender) each improvised their own spatial arrangement, and the skill badge's bottom three tiers are visually indistinguishable from each other. For a tool where organizers are scanning a queue fast to build fair matchups, both of those are real friction, not cosmetic nitpicks.

## What's Working

- **Deliberate OKLCH token fade**: `SkillBadge` variants step down `primary`/`accent`/`ink` opacity per tier (S → border+20%, A → 12%, B → accent 12%) — an actual design idea, not a copy-pasted badge.
- **Accessibility groundwork**: `aria-label`s on both badge components, `focus-visible` rings throughout, `min-h-[44px]` touch targets consistently applied.
- **Hand-tuned density typography**: arbitrary pixel sizes and `tabular-nums`/`font-mono` for counts show real attention to a table-like dense UI rather than defaulting to Tailwind's stock scale.

## Priority Issues

**[P1] Name truncates before decorative chips do**
**Why it matters**: In `PlayerPoolColumn.tsx` (PlayerRow, ~lines 102-118), the first name sits in a `flex-1 min-w-0 truncate` container while `SkillBadge`, `GenderIcon`, and the Playing/Matched pills all carry `flex-shrink-0`. Under width pressure — the queue column at typical desktop width, or any narrower viewport — the organizer's actual identifying information (the name) clips first while decorative chips stay full size. That's the wrong element to protect.
**Fix**: Give the name a `min-w` floor before it's allowed to truncate, or let the skill badge (not the gender icon or status pills) also flex-shrink first — skill tier is recoverable from context, a clipped name isn't.
**Suggested command**: `/impeccable layout`

**[P2] Skill + gender layout is inconsistent across the three panels**
**Why it matters**: `PlanningCard.tsx`'s `PlayerChip` (~lines 71-75) right-justifies skill+gender away from the name via `flex-1` on the name span, while `PlayerPoolColumn.tsx` and `CourtCard.tsx` left-cluster the same triad immediately after the name. Same data, different spatial grammar depending on which panel the organizer is looking at — that's a re-learning cost on every glance between panels.
**Fix**: Standardize on one arrangement (recommend left-clustered, matching two of three panels already) across all three.
**Suggested command**: `/impeccable layout`

**[P2] Three of seven skill tiers are visually identical**
**Why it matters**: `SkillBadge.tsx` lines 9-11 give D (Beg+), E (Beg), F (New) the exact same class string (`bg-ink/6 text-muted`). Beg vs Beg+ then differ only by a trailing "+" at 10px — a real misread risk during fast matchmaking scans, exactly the moment accuracy matters most.
**Fix**: Give D/E/F distinct treatment (even a subtle background or border step) so the tier is visually decodable, not just legible on close reading.
**Suggested command**: `/impeccable colorize`

**[P2] Gender icon is below reliable glyph-recognition size**
**Why it matters**: `GenderIcon` renders Mars/Venus at 11-14px. At that size the glyph shape is unlikely to be parsed as "male/female symbol" — it effectively degrades to a colored dot, making copper-vs-slate color the real signal even though the icon shape was meant to carry meaning too. That's a soft color-only-meaning risk for colorblind organizers, compounded by the fact that skill badges also use copper/slate/ink.
**Fix**: Either bump the minimum size where it appears in the densest contexts (PlanningCard's 11px), or accept it as a color-coded dot deliberately and drop the icon-shape pretense.
**Suggested command**: `/impeccable adapt`

**[P3] No visible tooltip on the skill badge**
**Why it matters**: `SkillBadge.tsx` sets only `aria-label` (screen-reader only); `GenderIcon.tsx` sets a real `title` that shows on hover. A sighted mouse user has no in-UI way to confirm what "Int+" means, while the adjacent gender icon does — an inconsistency even within this narrow scope.
**Fix**: Add `title={SKILL_LABELS[level]}` to `SkillBadge` so hover reveals the full label, matching `GenderIcon`'s existing pattern.
**Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Alex (Power User)**: Scanning the queue fast to build matchups is exactly Alex's workflow. The Beg/Beg+ near-identity and D/E/F visual collapse mean Alex can't diff skill tier at a glance across a full queue — they have to stop and re-read text every time, which is friction at precisely the moment they're optimizing for speed. Worse, the PlanningCard's mirrored layout means the scan pattern Alex builds in the queue panel doesn't transfer to matchup cards — they re-orient every time they move between panels.

**Sam (Accessibility-Dependent)**: The gender icon's shape is unlikely to register at 11-13px, so color (copper vs slate) becomes the real signal — but skill badges also use copper/slate/ink treatments for unrelated meaning, creating a color-overload risk for a colorblind organizer trying to distinguish "male, seeded player" from "female, seeded player" at a glance. On the plus side, `aria-label`s are present throughout, so a screen-reader user specifically is actually well served here — it's the low-vision-but-sighted case that's underserved.

## Minor Observations

- S and A (Seeded/Advanced — arguably the two tiers organizers most need to get right) are both copper, differentiated only by a border and an opacity step.
- CourtCard's PlayerRow omits games-played, present in PlayerPoolColumn, absent in PlanningCard and CourtCard — same player entity, different secondary metadata per panel.
- The GripVertical handle (10px) and gender icon (13px) bookend the row with two more small glyphs, compounding glyph density in an already busy 44px row.
- `mock-data.ts` doesn't currently exercise a player with no gender set — worth confirming the row doesn't visibly wobble when that icon is absent.

## Questions to Consider

- If two tiers differ only by a trailing "+" and three are pixel-identical, is the badge actually being read as color, or is the organizer silently re-reading text every time — in which case does it need seven distinct visual tokens, or three coarser buckets with the label always spelled out?
- The same copper token currently means "Seeded/Advanced skill," "Male," and "tappable primary action" elsewhere in the UI. Would an organizer's eye ever expect the skill badge or gender icon to be tappable because of that color reuse?
