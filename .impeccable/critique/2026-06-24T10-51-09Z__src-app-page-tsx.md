---
target: dashboard
total_score: 21
p0_count: 0
p1_count: 2
timestamp: 2026-06-24T10-51-09Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live timers + StatusBadges excellent; no loading/skeleton states designed |
| 2 | Match System / Real World | 3 | Clear language throughout; "Void" may need context for a first-time organizer |
| 3 | User Control and Freedom | 2 | End, Void, and Close Session are all irreversible with zero confirmation |
| 4 | Consistency and Standards | 3 | Cohesive system; minor button-style drift between CourtCard and ActiveMatches rows |
| 5 | Error Prevention | 2 | End/Void buttons sit adjacent with similar weight; Close Session is a single tap |
| 6 | Recognition Rather Than Recall | 3 | Section headers clear; sidebar icon-only on tablet (hover-only label discovery) |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; no batch actions; single rigid path for every task |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and on-brand; three equal-weight sections, no visual north star |
| 9 | Error Recovery | 1 | Happy path only; no error states, no recovery messages anywhere |
| 10 | Help and Documentation | 0 | None — expected at this stage but worth flagging |
| **Total** | | **21/40** | **Acceptable — significant improvements needed before users are happy** |

## Anti-Patterns Verdict

**LLM assessment:** No slop detected. OKLCH dark palette with Court Copper at L=0.71, JetBrains Mono for data only, Space Grotesk for UI voice — committed decisions, not defaults. No gradient text, no hero metrics, no cream background, no numbered eyebrows. One drift: all three section headers follow identical icon+heading+(count) rhythm, creating a scaffolded feel.

**Deterministic scan:** detect.mjs returned zero findings across full src/ tree. Clean.

**Visual overlays:** Browser automation unavailable; overlay injection not attempted.

## Overall Impression

Structurally sound, aesthetically disciplined, but operationally unsafe. The organizer can read everything at a glance, but one mis-tap on End/Void/Close Session has no guard. Biggest opportunity: treat the three panels as a hierarchy, not a grid — Courts, Active Matches, and Queue carry identical visual weight but serve different roles in the organizer's loop.

## What's Working

1. **Court cards: binary clarity, immediate action.** Available/In-Use split with Court Copper CTA on available and ghost End on in-use is exactly right for courtside glancing.
2. **Live elapsed timers as ambient data.** JetBrains Mono renders these as readings, not decoration. Instant situational awareness without interaction.
3. **Design system restraint.** Court Copper only on primary actions, everything else at muted/ink, flat-by-default.

## Priority Issues

**[P1] `text-muted` fails WCAG AA contrast across all surfaces**
- text-muted (L=0.55) on bg (L=0.09) ≈4.26:1; on surface (L=0.13) ≈4.14:1; both below 4.5:1 threshold. text-muted/60 ≈2:1.
- Used extensively: section counts, queue positions, "vs" labels, timers, nav labels, session stats.
- Fix: Bump --color-muted-raw from 0.55 to 0.62. Audit and remove all text-muted/60 usages.
- Command: /impeccable audit

**[P1] Destructive actions have zero confirmation or undo**
- End, Void, Close Session are single-tap irreversible operations. End/Void are adjacent ~28px buttons in flex gap-1.
- Fix: End → inline result picker (Side A/B/Draw + Walkover). Void → confirm dialog. Close Session → confirm with consequence stated.
- Command: /impeccable harden

**[P2] Active Matches section duplicates Court Cards — unclear mental model**
- Same match data, same timers, same End button, two renderings. Users may wonder if acting in one also acts in the other.
- Fix: Either (a) CourtCards own all match actions, remove ActiveMatchesSection; or (b) CourtCards become status-only, ActiveMatchesSection owns all actions.
- Command: /impeccable distill

**[P2] "Suggest Match" is the dashboard's primary action but has secondary placement**
- Buried inside Queue section card, below fold on tablet. Primary operational trigger deserves dashboard-level placement.
- Fix: Promote to session header bar (between Open badge and Close Session button).
- Command: /impeccable layout

**[P3] 10px text in BottomBar labels and In-Match badge is too small**
- BottomBar.tsx:45 text-[10px] for nav labels. QueueSection.tsx:31 text-[10px] for "In Match" tag.
- Fix: Bump to text-xs (12px) for both.
- Command: /impeccable audit

## Persona Red Flags

**Alex (Power Organizer):** No keyboard shortcuts. End→New Match requires two separate section navigations. No direct-from-court-number action path.

**Sam (Accessibility):** Sidebar hover-only tooltips fail visual keyboard users. SkillBadge uses title attribute (not reliably announced). text-muted/60 empty state text ≈2:1 contrast. CourtCard End Match button min-h-[32px] below 44px touch target spec.

## Minor Observations

- formatSessionDate hardcodes "en-US" locale
- CourtCard End Match button is min-h-[32px], below 44px touch target spec from DESIGN.md
- MatchType referenced in ActiveMatch type but not defined in types/index.ts — verify resolve
- text-border separator dot in header is L=0.20, effectively invisible on bg
- Mobile header hides player/court counts (hidden sm:flex) — no session stats at a glance on phone
