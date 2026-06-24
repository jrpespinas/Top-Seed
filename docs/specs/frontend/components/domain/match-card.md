# MatchCard

## Purpose

Displays queued, assigned, active, completed, or cancelled badminton match details. On the live pegboard, staged (`queued` / `queuedIncomplete`) cards are **movable tokens** in the `Next` zone — the organizer should read team pairing, fill progress, and the single next action at a glance.

## Source Specs

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/features/organizer/next-queue-panel.md`
- `docs/specs/frontend/features/organizer/desktop-drag-and-drop.md`
- `docs/specs/backend/domain-model.md`

## When To Use

- Use for next queue matches, active matches, recent match history, and match detail summaries.

## When Not To Use

- Do not use as the full court operation card when court state is primary; use `CourtCard`.

## Props Or Data Contract

- `match`: id, status, court, teams, scores, outcome, winner, ratingApplied, timestamps.
- `queueLane`: optional id and name when the card represents a queued match.
- `matchIndex`: optional 1-based position in lane (header: `Match #1`).
- `actions`: move to lane, move to court, swap player, start, finish, record score, cancel, remove from queue, or view details.
- `footerActions`: optional slot for parent-composed primary CTA (e.g. `SendToCourtAction`).
- `showRatingImpact`: optional.
- `perspectivePlayerId`: optional for player-facing partner/opponent emphasis.
- `slotState`: optional state for incomplete queued matches.
- `editableSlots`, `dndEnabled`, `onAddPlayerToSlot`, `onRemovePlayerFromSlot`: staging interactions per `desktop-drag-and-drop.md`.

## Variants And Sizes

| Variant | Use | Visual emphasis |
|---------|-----|-----------------|
| `queuedIncomplete` | `draft` match with empty slots | Warm `next` border tint; fill progress visible |
| `queued` | `ready` staged match (4 players) | Warm `next` surface or left accent; primary **Send to court** |
| `assigned` | Match on court, not started | Court name prominent |
| `active` | In progress | Court ring / `court` token |
| `completed` | Finished with result | Muted; outcome text |
| `history` | Session history list | Compact; correction affordance when applicable |
| `playerUpcoming` | Future player self-service | Deferred |

## Card Anatomy (Staged / Queued)

Staged match cards use a **three-band layout**:

```text
┌─ Header ─────────────────────────────────────┐
│ Match #n · [Status] · [fill 3/4]    [⋯ menu] │
│ optional: Suggested badge                      │
├─ Roster ─────────────────────────────────────┤
│  Team A          │ vs │  Team B               │
│  [slot 1]        │    │  [slot 1]             │
│  [slot 2]        │    │  [slot 2]             │
├─ Footer (live only) ─────────────────────────┤
│ [ Send to court — primary, full width ]      │
└──────────────────────────────────────────────┘
```

### Header

**Must show**

- Match index (`Match #1`) — position in lane, not global session order.
- Status badge with semantic tone (see Status encoding).
- Fill progress for `draft` matches: `2/4 players` or `Needs 2 players` (not both).

**May show**

- `Suggested` pill when `createdFrom === "suggestion"`.
- Informational warning when a player is staged in multiple matches (icon + tooltip or caption; not a hard block).

**Must not show in header**

- Lane name when the parent lane switcher already shows selected lane (avoid `Queue 2` under every card). Lane name is allowed only in multi-lane desktop columns where cards from different lanes appear together.

**Header actions**

- One overflow menu (`⋯`) for secondary/destructive actions: **Remove match**, **Move to lane** (when applicable).
- Do **not** duplicate remove affordances (no header `X` **and** footer **Remove match**).
- Desktop DnD: drag handle on header when `ready` and DnD enabled (`desktop-drag-and-drop.md`).

### Roster (team columns)

**Gestalt / pairing**

- Two columns with a subtle **vs** divider (vertical rule or centered label) so opponents are obvious.
- Partners in the same column share vertical proximity; do not flatten four players into one list.
- Team labels: `Team A` / `Team B` (or localized equivalents). Keep consistent with court cards.

**Filled slots**

- Compact player token: avatar initials + display name only (no nested card border inside card — use a flat row or inset row, not card-in-card).
- Slot actions use **progressive disclosure**:
  - Default: player token only.
  - Hover, focus-within, or slot overflow (`⋯`): **Remove from match**, **Move to other slot** (future P3).
- Do not show four always-visible **Remove** text buttons on a full ready match — they compete with **Send to court** and violate progressive disclosure.

**Empty slots (`queuedIncomplete`)**

- Dashed or muted inset target with label `Add player` (button) or `Drop player here` when DnD enabled.
- Accessible name: `Team A slot 1, empty` per `next-queue-panel.md`.
- DnD active: `ring-2 ring-primary/40 bg-primary/5` on valid drag-over.

**Remove below-card copy**

- Do not render `Needs N player(s)` as a separate line under the card when fill progress is already in the header.

### Footer (staged, live session)

**One primary action per card state**

| State | Primary footer CTA | Variant |
|-------|-------------------|---------|
| `draft` | None, or subtle `Add players to send` helper text | — |
| `ready` | **Send to court** (or **Send to Court 3** when one open court) | `primary` |
| `ready`, multiple open courts | **Send to court…** opens court picker | `primary` |

**Secondary actions**

- Destructive and lane operations live in header overflow menu, not beside the primary CTA.
- Footer may include a single text link only when it does not duplicate overflow (prefer overflow for **Remove match**).

## Status Encoding

Use `StatusBadge` with readable title case labels (`Ready`, `Draft`, not raw `ready`).

| Status | Label | Tone |
|--------|-------|------|
| `draft` / `queuedIncomplete` | `Needs players` or `2/4` progress | `next` / warm attention |
| `ready` / `queued` | `Ready` | `next` success — card may use `border-next/40` or left accent bar |
| `assigned` | `On court` | `info` |
| `active` / `in_progress` | `Playing` | `court` |
| `completed` | Outcome label | muted |
| `cancelled` | `Cancelled` | muted, not success |

Ready cards should feel **actionable** (warm highlight, obvious send CTA) — not identical to incomplete drafts.

## States

- Queued incomplete (`draft`), ready (`ready`), moving between lanes, assigned, in progress, completed, cancelled.
- Loading action on primary CTA (send to court).
- Pending sync indicator on card when queued match sync is pending (optional corner badge).
- Correction available on history variant.

## Accessibility

- Team pairing must be readable in text (`Team A` / `Team B` headings).
- Score and winner must not rely on color alone.
- Slot remove actions: `Remove {playerName} from match` (not unlabeled **Remove**).
- Send to court: `Send match #1 to Court 3` when court is known.
- Empty slots: `Team B slot 2, empty`.
- Drag handle: `Drag match #1 to court` when DnD enabled.
- Keyboard: all slot and match actions available without drag.

## Responsive Behavior

**Mobile (Next tab)**

- Roster may stack Team A above Team B with `vs` between; keep primary CTA full width at bottom.
- Overflow menu for remove / lane move.

**Tablet / Desktop**

- Side-by-side team columns with `vs` divider.
- Progressive disclosure for slot remove on hover/focus.
- Ready match: header drag handle when DnD enabled.

## Content Rules

- Use `Team A` and `Team B` labels with player names in slots.
- Result labels: `Won`, `Lost`, `Draw`, `Cancelled`, `Unscored`.
- Staging copy: `Send to court`, `Add player`, `Needs 2 players`, `Suggested`.
- Do not show internal labels such as `Paired 1x` — not organizer-facing language.
- Draw must not be presented as a win for either side.

## UX Principles Applied

| Principle | Application on staged MatchCard |
|-----------|----------------------------------|
| **Visual hierarchy** | One primary CTA; status + fill progress in header; warm ready state |
| **Progressive disclosure** | Slot remove in overflow/hover; destructive match remove in header menu |
| **Fitts's Law** | Full-width **Send to court** on mobile; largest tap target in footer |
| **Gestalt proximity** | Partners stacked in column; opponents separated by `vs` |
| **Recognition over recall** | `Send to Court 3` names the destination when unambiguous |
| **Consistency** | Same team column pattern as `CourtCard`; same tokens as `Next` zone |
| **Error prevention** | `ready` styling only at 4 players; send disabled with reason when no open court |
| **Aesthetic-usability** | Flat player rows reduce nested-border noise; calm card chrome |

## Testing Expectations

- Renders all match statuses with correct badge labels.
- `draft` shows fill progress; `ready` shows primary send CTA.
- Editable slots: **Add player** on empty; remove via overflow with player name in label.
- No duplicate remove match controls (header X + footer link).
- Footer primary uses `primary` variant when `ready`.
- Renders lane movement actions when `queueLane` context is provided.
- DnD: droppable empty slots when enabled; draggable header when `ready`.

## Anti-Patterns

- Showing cancelled matches like completed results.
- Four visible **Remove** links on a full ready match.
- Duplicate **Remove match** in header `X` and footer.
- Raw lowercase status strings (`ready`) in badges.
- Nested mini-cards with double borders inside team slots.
- `Paired 1x` or algorithm jargon on organizer cards.
- Lane name under every card when lane switcher is visible.
- Secondary-styled **Send to court** competing with ghost **Remove** buttons.
- Hiding incomplete slots or flattening four players without team structure.
- Drag-only slot edits without button/menu alternative.
