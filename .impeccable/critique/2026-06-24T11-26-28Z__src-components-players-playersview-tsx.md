---
target: players
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-06-24T11-26-28Z
slug: src-components-players-playersview-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Saving…" state exists, but drawer closes silently — no post-save confirmation; Queue button produces zero feedback |
| 2 | Match System / Real World | 3 | Domain terminology correct; minor gap — Queue icon-only on mobile is ambiguous |
| 3 | User Control and Freedom | 3 | Escape + backdrop + Cancel in drawer ✓; missing: no "discard changes?" guard when closing a dirty drawer |
| 4 | Consistency and Standards | 3 | Cohesive with dashboard; minor: mobile "Add" vs desktop "Add Player" label split |
| 5 | Error Prevention | 2 | Name validation on save ✓; critical gap: dirty drawer can be silently dismissed, losing edits with no warning |
| 6 | Recognition Rather Than Recall | 2 | Skill level abbreviations S–F have no visible legend; icon-only Queue on mobile; Inactive state on mobile is opacity-only |
| 7 | Flexibility and Efficiency | 2 | Search is immediate ✓; no bulk actions, no sort controls, no keyboard shortcuts for primary operations |
| 8 | Aesthetic and Minimalist Design | 3 | Clean list, no clutter; player count header doesn't reflect current view when inactive players are shown |
| 9 | Error Recovery | 3 | Inline form errors clear and anchored ✓; server-error handling absent (expected at mock stage) |
| 10 | Help and Documentation | 2 | "·private" hint ✓, history indicator ✓; skill level system has no visible explanation for new organizers |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Largely no AI slop. Dark theme, domain-specific filtering (7 skill chips), and the skill history indicator all signal intentional product thinking. Two areas read closer to generic scaffold: (1) the sticky header follows the standard CRUD admin pattern without distinctive character; (2) the filter bar feels assembled rather than designed — 7 chips + search + toggle + clear on one row.

**Deterministic scan**: Zero hits across both files. No gradient text, no side-stripe borders, no eyebrow labels, no hero-metric structures.

**Visual overlays**: Browser automation not available. No overlay injection attempted.

## Overall Impression

Structurally sound, well-coded. The drawer form is the strongest piece. The biggest problem is a cluster of mobile issues that compound: touch targets at 36px, icon-only Queue button, opacity-only Inactive signal, and focus not trapped in the drawer. The single biggest opportunity: dirty-drawer data loss — accidental backdrop tap on mobile discards edits silently.

## What's Working

1. **Drawer form quality.** Skill segmented control (`role="radiogroup"` + `role="radio"`, 44px height, per-level styling), skill-change history indicator, and status toggle (`role="switch"`) are polished and accessible.
2. **Filter state management.** Multi-select skill chips with `Set<SkillLevel>`, contextual Clear link only when filters active.
3. **Inactive handling.** Hidden by default, count in toggle button, `opacity-50` row treatment — discoverable without being prominent.

## Priority Issues

**[P1] Touch targets below 44px minimum**
Queue button `min-h-[36px]` and Pencil button `min-h-[36px] min-w-[36px]` fall below WCAG 2.5.5 minimum. Fix: increase both to `min-h-[44px]` / `min-w-[44px]`.
Suggested command: /impeccable adapt

**[P1] Dirty drawer closes silently, discarding unsaved changes**
No `isDirty` tracking. Backdrop tap or Escape during an edit discards changes without warning. Fix: track isDirty, show inline "Discard changes? / Keep editing" row when closing dirty.
Suggested command: /impeccable harden

**[P1] Skill level abbreviations have no visible legend**
S/A/B/C/D/E/F shown as letters only — sighted users have no reference. aria-label exists for SR only. Fix: show selected level's full SKILL_LABELS text below the segmented control in the drawer; add tooltip/title on filter chips.
Suggested command: /impeccable clarify

**[P2] Focus not trapped in the drawer**
Tabbing past Cancel returns focus to the list behind the backdrop. WCAG 2.1 SC 2.1.2 requires focus trap inside open modal. Fix: useFocusTrap hook or @radix-ui/react-focus-trap.
Suggested command: /impeccable harden

**[P2] Player count doesn't reflect current view state**
Header shows `activeCount` always; when inactive visible, "Players (10)" with 12 rows visible. Fix: show `filteredPlayers.length` when any filter or inactive toggle active.
Suggested command: /impeccable clarify

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcut for Add Player. No bulk actions — marking 5 players inactive requires 5 separate drawer opens. Queue is one-at-a-time. 36 tab stops on a 12-player list (3 interactive elements × 12 rows).

**Sam (Accessibility-Dependent User)**: Focus trap missing — screen reader escapes drawer. setTimeout(50) focus delay may cause VoiceOver to announce list before drawer heading. Inactive badge hidden on mobile (`hidden sm:block`) — opacity-50 alone doesn't convey "Inactive" to screen readers. Backdrop lacks `inert` attribute.

**Casey (Distracted Mobile User)**: 36px touch targets misfire under gym conditions. Filter bar wraps to 2 lines when full (search + inactive toggle visible) → ~108px sticky header eats 20% of 375px viewport. Icon-only Queue button ambiguous to new organizers.

## Minor Observations

- `hasFilters` excludes `showInactive` — "Clear" doesn't reset inactive toggle, leaving stale state visible despite clear signal.
- `role="list"` div can render `ListEmptyState` as a child — ListEmptyState is not a `listitem`, making the list role invalid for some screen readers.
- `FormData` local interface shadows global Web API `FormData` — rename to `PlayerFormData` to remove reader-surprise.
- `data.notes || undefined` in handleSave — simplify to `data.notes`, handle empty string at query layer.

## Questions to Consider

- "What happens when an organizer searches for a player during a live match — should the Queue button be context-aware (disabled if already in queue or in a match)?"
- "Does the Players page need to know the active session state, or is it purely roster management disconnected from session state?"
- "Should skill filter chips communicate level rarity (S is rare), not just flat alpha styling?"
