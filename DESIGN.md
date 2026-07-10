---
name: Top Seed
description: Professional badminton session management for competitive organizers
colors:
  bg: "oklch(0.09 0 0)"
  surface: "oklch(0.13 0 0)"
  surface-elevated: "oklch(0.18 0.004 38)"
  border: "oklch(0.28 0.006 38)"
  ink: "oklch(0.94 0.005 38)"
  muted: "oklch(0.62 0.006 38)"
  primary: "oklch(0.71 0.17 38)"
  primary-hover: "oklch(0.76 0.16 38)"
  accent: "oklch(0.62 0.14 220)"
  success: "oklch(0.65 0.17 145)"
  warning: "oklch(0.75 0.14 75)"
  error: "oklch(0.62 0.21 25)"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.01em"
    lineHeight: 1.2
  body:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "0.9375rem"
    lineHeight: 1.5
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 500
    fontSize: "0.875rem"
    lineHeight: 1.4
  label:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontWeight: 500
    fontSize: "0.75rem"
    letterSpacing: "0.01em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.bg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "oklch(0.62 0.21 25 / 15%)"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-item:
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "8px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
  skill-badge:
    width: "20px"
    height: "20px"
    rounded: "{rounded.sm}"
    typography: "{typography.data}"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    typography: "{typography.label}"
  payment-toggle:
    rounded: "{rounded.sm}"
    padding: "2px"
    typography: "{typography.label}"
---

# Design System: Top Seed

## 1. Overview

**Creative North Star: "The Director's Bench"**

Top Seed is a professional operations tool — the kind an experienced tournament director would choose. Dark, precise, and deliberately undecorated. The interface should feel like a control room, not a mobile app. Every element earns its presence. The organizer standing courtside with a tablet should feel equipped, not entertained.

The typographic system does the heavy lifting. Bold geometric headings (Space Grotesk) for player names, session titles, and labels; monospace (JetBrains Mono) for every number that matters — queue positions, win rates, match counts, payment amounts. Data is data. It gets its own voice. The brand color (a warm copper-coral, `oklch(0.71 0.17 38)`) is used sparingly: primary actions, active states, the moment when a match begins. Its rarity is the point. Everything else is ink on near-black.

This is not a friendly app. It does not use soft card shadows, grid layouts with identical tiles, or welcoming illustrations. It is a precision tool for someone running a competitive session where speed and clarity matter more than aesthetics. The premium feel comes from restraint, precision, and zero visual noise.

The surface has grown since this system was first documented — Sessions (list + detail, with an Excel export), Settings (a Danger Zone for data resets), and manual Payment tracking are now real, shipped pages, not just the Dashboard/Players/Matches/Leaderboard core. None of them earned a register change: same dark canvas, same restraint, same two-step confirm for anything destructive.

**Key Characteristics:**
- Near-pure black background; warmth lives in the brand copper only, never in the surface
- Monospace for all numerical data; geometric sans for all text and labels
- One accent color (copper-coral) used exclusively for active states and primary CTAs
- Flat surfaces with tonal separation only; shadows reserved for focused primary elements
- Responsive motion (150–250ms) via `motion/react`; `MotionConfig reducedMotion="user"` wraps every animated section
- Tablet-first tap targets — minimum 44×44px, primary session actions 48×48px

## 2. Colors: The Midnight Court Palette

A committed dark palette anchored by one copper-coral accent. All neutrals are pure black variants; all warmth is delivered by the brand color alone.

### Primary
- **Court Copper** (`oklch(0.71 0.17 38)`): The brand anchor. Used exclusively on primary action buttons (Start Match, Assign to Court, Confirm), active navigation states, and the open-session badge. Never decorative. Its hover variant (`oklch(0.76 0.16 38)`) lightens slightly rather than darkening, preserving warmth under bright gym lighting.

### Secondary
- **Steel Slate** (`oklch(0.62 0.14 220)`): A cool slate-blue for secondary highlights and non-destructive secondary actions. Contrasts the copper without competing with it. Used for In Use / In Progress court status badges.

### Tertiary
- **Court Green** (`oklch(0.65 0.17 145)`): Semantic only. Available court status, Paid payment status. Never decorative.
- **Caution Amber** (`oklch(0.75 0.14 75)`): Semantic only. Unpaid payment status, outstanding balance warnings.

### Neutral
- **Void Black** (`oklch(0.09 0 0)`): Page background. No chroma. No hue tint. Never warmed.
- **Charcoal Panel** (`oklch(0.13 0 0)`): Card and panel backgrounds. The primary surface layer.
- **Lifted Surface** (`oklch(0.18 0.004 38)`): Elevated elements — hover states, dropdowns, modals. A barely-perceptible tilt toward the brand hue (chroma < 0.005).
- **Field Border** (`oklch(0.28 0.006 38)`): Structural dividers between panels, card borders, form field outlines. Light enough to recede, dark enough to separate.
- **Ash Ink** (`oklch(0.94 0.005 38)`): Body and heading text. Near-white with imperceptible warmth. Contrast vs Void Black ≥12:1.
- **Graphite Muted** (`oklch(0.62 0.006 38)`): Secondary labels, placeholder text, helper copy, inactive controls. Achieves ≥7:1 contrast against Void Black — courtside-grade legibility even for secondary information.
- **Error Red** (`oklch(0.62 0.21 25)`): Destructive actions and error states. Used at 10–15% opacity for backgrounds, full for text.

**The One Signal Rule.** Court Copper appears on at most one focal point per screen region at a time. Its rarity is what communicates "this is the primary action." When two copper elements compete in the same region, the signal collapses into decoration.

**The Pure Void Rule.** The background is always `oklch(0.09 0 0)` — no chroma, no hue tint. Any warm tilt on the bg is prohibited. The warmth belongs to the accent; the canvas earns its contrast by being genuinely dark.

## 3. Typography: The Two-Voice System

**UI Voice:** Space Grotesk (700/600/500/400) — geometric, precise, scoreboard-weight at the bold end
**Data Voice:** JetBrains Mono (500) — designed for dense numerical data, legible at small sizes

**Character:** Space Grotesk's geometric structure gives headings and player names the authority of a scoreboard. JetBrains Mono brings analytical clarity to every quantitative value. The pairing creates a strict two-register system: narrative content (names, descriptions, labels) in sans; quantitative content (stats, counts, amounts, times) in mono. This distinction is structural, not decorative.

### Hierarchy

- **Display** (700, ~2rem, tracking -0.02em, lh 1.1): Page titles, session date, empty state headings. Space Grotesk.
- **Headline** (600, ~1.5rem, tracking -0.01em, lh 1.2): Section headers, player names on leaderboard, card titles. Space Grotesk.
- **Title** (600, ~1.125rem, lh 1.3): Table column headers, dialog titles, form section headings. Space Grotesk.
- **Body** (400, 0.9375rem, lh 1.5): Notes, descriptions, dialog copy. Max 65ch line length. Space Grotesk.
- **Label** (500, 0.75rem, tracking 0.01em): Status badges, chip labels, nav items, field labels. Space Grotesk.
- **Data** (500, 0.875rem, lh 1.4): All numerical values — win rates, payment amounts, queue positions, match counts. JetBrains Mono. Never sans for numbers that matter.

**The Monospace Conviction Rule.** Every number that carries meaning — a queue position, a win rate, a payment amount, a match count — is set in JetBrains Mono. Sans numerals are for incidental text only (e.g., "3 players"). If the number is data, it gets the data voice. A stat in Space Grotesk is a bug.

## 4. Elevation

Top Seed is flat by default. Tonal separation across the dark scale (Void Black → Charcoal Panel → Lifted Surface) provides all the depth the interface needs. No box-shadows on cards, list rows, or panels at rest.

The single exception: a diffuse copper glow is permitted on focused or hovered primary elements (Court Copper CTAs). The glow uses the primary color at reduced opacity (`ring-primary/50`) — never a generic gray shadow — so the copper signal is reinforced rather than diluted by unrelated depth.

Interactive states use two elevation signals: `bg-surface-elevated` for hover (tonal lift) and `ring-1 ring-primary/40` for selected/active states (color lift). These combine but never compete — tonal lift is structural, color lift is semantic.

### Named Rules

**The Flat-by-Default Rule.** A shadow on a card at rest means one of two things: the card was copied from a light-mode design system without adaptation, or the elevation is genuine (modal, dropdown, tooltip). Any `box-shadow` that isn't on a focused primary element or a floating overlay is wrong.

**The Tonal Stack Rule.** Depth is expressed through the three-step neutral ramp: bg → surface → surface-elevated. A component that sits on `surface` uses `surface-elevated` for its hover state, and `bg` for its bottom border/divider. The stack always goes bg → surface → surface-elevated, never in reverse.

Sticky headers use the same rule for a second trigger: scroll position, not just hover. A sticky title bar sitting at `bg` switches to `bg-surface-elevated` once the page has scrolled past it, paired with a plain `0 1px 0 var(--color-border)` line — never a black-tinted blur shadow. A blurred black shadow is nearly invisible against the near-black default theme; lightness is this system's only valid depth signal, in both themes. (This replaced an earlier interim fix that tried to fix the shadow's color instead of abandoning shadow-for-depth in dark mode — the color-based fix was the wrong instinct, corrected during the session-page audit.)

## 5. Components

Precision tools for the organizer who is standing, glancing, and acting. Every component has complete states: default, hover, focus-visible, active, disabled. Tap targets are minimum 44×44px — courtside use demands it.

### Buttons

Three variants, one shared radius (8px / `rounded-md`). All use 150ms ease-out transitions on `background-color` and `color`. `focus-visible:ring-2` replaces outline on all interactive elements.

- **Primary** (copper fill): `bg-primary text-bg` with `hover:bg-primary-hover`. Full-width (`w-full`) for primary session actions (Assign to Court, Start Match, End Match); content-width for contextual actions. Minimum height 44px (`py-2.5`) on courtside-priority actions; 36px (`py-1.5`) acceptable in dense UIs (headers, footers). The copper fill is the signal — only one per screen region.

- **Ghost / Secondary** (no fill): `text-muted hover:text-ink hover:bg-surface-elevated`, optional `border border-border/60`. Used for secondary actions (Add, Cancel, nav headers). The border variant signals form-level actions; the borderless variant signals list-level controls.

- **Destructive**: `bg-error/15 text-error hover:bg-error/25`, radius `rounded-sm` (4px) to visually differentiate from primary. Always inline-confirmed with a two-step cross-fade pattern (see Inline Confirm).

**The Two-Step Confirm Pattern.** Destructive actions (Remove, Void, Delete, Close Session, Reset Data) use an inline cross-fade: the action button cross-fades into a confirmation row (Confirm / Cancel) at the same row height without opening a modal. Animated via `AnimatePresence mode="wait"` with 120ms opacity + translate transitions. No modal, no navigation interruption.

Every instance of this pattern also moves keyboard focus explicitly on each transition — to Cancel when the confirm row appears, back to the original trigger button when it's dismissed (a `useRef` pair + a "was this confirming last render" ref, not React state, since the swap unmounts the focused element and drops focus to `<body>` otherwise). A confirm row a keyboard user can't immediately act on without re-tabbing from the page top is a broken instance of this pattern, not an acceptable variant.

Extracted to `useConfirmFocus(isConfirming, swapped?)` in `src/hooks/useConfirmFocus.ts` for the four sites whose confirm row always returns to one fixed trigger button (SessionHeader, PlayerDrawer, AddPlayersModal, SettingsView's DangerAction — the last passes `isConfirming || justDone` as the `swapped` override, since its transient "Done" state also counts as "away from idle"). MatchesView's Void/Restore confirm keeps its own bespoke ref handling rather than using the hook — its return target depends on `match.status`, not a single fixed button, a genuinely different shape than the other four share.

**The Ring-Not-Underline Rule.** Every focusable interactive element gets `focus-visible:ring-2` (color depends on context — `ring-primary/50` for primary actions, `ring-border` for neutral ones, `ring-error/40` for destructive). This includes bare inline-text actions (e.g. "Undo" inside a toast) that have no natural padding for a ring to sit in — give them `rounded-sm px-1 -mx-1` (padding counteracted by an equal negative margin) so the ring has room without shifting the surrounding text's position. Underline-only focus indicators are not a valid secondary convention in this system, even for dense inline contexts.

### Skill Badge

The most frequently rendered component — appears on every player row, chip, and picker. A compact square (`20×20px`, `rounded-sm` 4px) in JetBrains Mono Bold at 11px. Seven levels (S → F), each with a distinct color tier:

| Level | Background | Text |
|-------|-----------|------|
| S | `bg-primary/20 border border-primary/30` | `text-primary` |
| A | `bg-primary/12` | `text-primary/80` |
| B | `bg-accent/12` | `text-accent` |
| C | `bg-ink/8` | `text-ink/60` |
| D–F | `bg-ink/6` | `text-muted` |

The S tier gets a visible border to distinguish the top rank at a glance; all others use background-only tints. Never use a color outside this table for skill levels — the gradation is the signal.

### Status Badge

Pill-shaped (`rounded-pill`, `px-2 py-0.5`) in Label type (Space Grotesk 500, 12px). All variants use color at 15% opacity for backgrounds and full opacity for text, maintaining legibility against Charcoal Panel.

| Variant | Background | Text |
|---------|-----------|------|
| available / paid | `success/15` | `success` |
| in-use / in-progress | `accent/15` | `accent` |
| open | `primary/15` | `primary` |
| completed / closed / waived | `surface-elevated` | `muted` |
| voided | `error/10` | `error` |
| unpaid | `warning/15` | `warning` |

Text inside StatusBadge uses `tabular-nums` to prevent layout shift when badge labels of different widths appear in the same column.

### Payment Toggle

A three-segment inline control for the manual payment ledger (Paid / Unpaid / Waived) — appears on the Players table and the Sessions detail table. One tap sets the exact state directly; it never cycles through unwanted states first. Container: `rounded-sm` (4px), `bg-bg`, `border border-border/60`, 2px internal padding. Each segment is content-sized (not a fixed square) so full words fit without truncation.

Active-state colors are semantic, not decorative: Paid uses `success/15` background + `success` text (the same pairing as StatusBadge's paid variant); Waived uses `primary/12` + `primary` (a deliberate, distinct third color so it's never mistaken for "still owing"); Unpaid uses a neutral `surface-elevated` + `ink` fill — it's the default state every player starts in, so it stays quiet rather than reading as an alarm. Inactive segments are bare `text-muted`, no background, until hovered.

### Navigation

Two complementary nav surfaces — Sidebar and BottomBar — sharing an identical primary-item vocabulary. `md:` (768px) is the single switch point between them, which per this project's own breakpoint definitions (`CLAUDE.md` — Tablet: 768px+) makes Sidebar the tablet **and** desktop nav, not desktop-only; BottomBar serves phones exclusively.

**Sidebar** (`hidden md:flex`, 768px+): Fixed-left, 80px wide (`w-20`), `bg-surface border-r border-border`, `z-sticky`. Logo lockup at top (64px tall header, "TS" in Court Copper, Space Grotesk Bold 18px). Nav items stacked vertically with icon (16px) above label (9px, font-medium), each `min-h-[44px]`. Settings and ThemeToggle are pinned to the bottom below a divider, matching the same 44px floor and icon/label sizing as the primary items above them.

**BottomBar** (`md:hidden`, below 768px): Fixed-bottom, 60px tall, same `bg-surface border-t border-border`. Five primary destinations share the row as equal `flex-1` slots (Dashboard, Sessions, Players, Matches, Rankings — same order and same nav labels as Sidebar), icons at 20px (slightly larger than sidebar for thumb recognition), labels at 10px. The Leaderboard feature's nav label reads "Rankings" (not "Leaderboard") in both surfaces — at 375px's ~52px-per-item budget, "Leaderboard" (11 characters) doesn't fit without truncating; "Rankings" (8 characters) does, and it's already the app's own internal vocabulary for this feature (see the empty states and `aria-label`s in `LeaderboardView.tsx`). The page itself still opens on a "Leaderboard" heading — only the nav label changed. A vertical divider separates the primary five from a narrower fixed-width utility segment — Settings then ThemeToggle, each pinned to a 48px column — deliberately sized down to Sidebar's own convention rather than the Bottom Bar's primary-row sizing: icons at 16px, labels at 9px, both items matching each other exactly so the utility pair reads as one consistent secondary tier. Seven interactive targets in total, all `min-h-[44px]` regardless of segment.

**Item states** (shared vocabulary):
- Default: `text-muted`, icon `strokeWidth={1.75}`
- Active: `bg-primary text-bg` (sidebar) / `text-primary` (bottom bar, no fill), icon `strokeWidth={2.5}`
- Hover: `hover:text-ink hover:bg-surface-elevated` (sidebar only — bottom bar has no hover)
- Focus: `focus-visible:ring-2 focus-visible:ring-primary/50` on every nav item in both surfaces — `ring-inset` on Bottom Bar's edge-flush items (the primary five and Settings) so the ring stays inside the element instead of risking clipping against the viewport edge.

The active sidebar item gets a copper fill block (`bg-primary text-bg`), making it the only non-text copper element in the nav. Bottom bar active is copper text only (no fill) — appropriate for a touch surface where fill can feel heavy.

### CourtCard

The highest-stakes card in the application. Two root states: **Available** and **In Use**. Both use `bg-surface border border-border rounded-lg` with no shadow at rest.

**Available state**: Header shows court number + StatusBadge. Body contains a full-width "New Match" primary button (`min-h-[44px]`). Drop-target state during planning card drag: `ring-2 ring-primary/50 bg-primary/12 border-primary/30`. Blocked state (another card dragging, court in use): `opacity-40 cursor-not-allowed`.

**In Use state**: Header shows court number + "In Use" badge. Body shows Side A players, "vs" divider text, Side B players (each as first name + SkillBadge). Footer has elapsed timer (JetBrains Mono, `text-muted`) + End and Void buttons. The elapsed timer is the only continuously updating element in the interface — it uses a client-side interval, no server polling.

**Confirm states**: Both End and Void open inline within the card footer (no modal). End shows a three-button picker (Side A / Draw / Side B) in a `grid-cols-3` layout. Void shows a compact Confirm Void / Cancel row. Delete shows Confirm Delete / Cancel. All use `min-h-[44px]` on every confirm button.

**Ring signaling**: `ring-1 ring-primary/25` on active confirm (End/Void); `ring-1 ring-error/25` on delete confirm. The ring communicates "this card has an open decision" without changing the card's shape or layout.

### PlanningCard

The matchup staging card. Fixed width of `w-[76vw] md:w-[252px]` in horizontal scroll (`fullWidth` override for column layout). Three states: **Empty**, **Filling**, **Ready**. Border transitions: dashed (`border-dashed border-border/50`) → solid (`border-border`) → copper (`border-primary/40`).

**Header**: Match type toggle (`1v1` / `2v2`) on the left — pill-group style with `bg-surface-elevated text-ink` for active, `text-muted` for inactive. Grip icon (12px, `text-muted/40`) + Dismiss (`×`) on the right. The grip's low opacity is intentional: it signals drag affordance without competing with the type toggle.

**Body**: Stacked Side A / vs / Side B layout. Side A chips render first, then a "vs" divider row (`flex items-center gap-1.5 py-1` with `border-t border-border/40` lines flanking centered "vs" text in 10px muted), then Side B chips. This vertical stack matches how coaches write matchups on whiteboards — partners together, opponents below. Empty slot placeholders are dashed `border-border/50` boxes (`h-7 rounded-sm`); they highlight to `border-primary/50 bg-primary/10` when a player is being dragged over the correct slot.

**Player Chip**: Button (`rounded-sm px-1.5 py-1.5`) with first name + SkillBadge. Selected state: `bg-primary/12 ring-1 ring-primary/40`. Remove `×` reveals on hover at `-top-1 -right-1` (7px icon, `rounded-full`, `opacity-0 group-hover:opacity-100`). On touch: `@media(hover:none)` keeps remove button visible at all times.

**Chip swap interaction**: Tap a chip to select it (state stored in `selectedChip`). A hint ("Tap another player to swap") + Cancel button appear below the chips. Tap a second chip to execute the swap via `onSwap`. Tap the same chip or Cancel to deselect. The swap is immediate with no animation — speed over choreography.

**Footer — court picker expansion**: "Assign to court" button (`w-full py-2.5 bg-primary text-bg rounded-md`) is the primary CTA. On tap, the button cross-fades (via `AnimatePresence mode="wait"`) to an inline court list: a 10px "Assign to court:" label, then court buttons (`bg-primary/10 hover:bg-primary text-primary hover:text-bg`), then a Cancel link. The cross-fade uses 150ms opacity + 4px y-translate. This keeps the court selection spatially anchored to the card that triggered it — the organizer never loses the spatial link between "which matchup" and "which court."

**Drag affordance**: The card itself is draggable (`cursor-grab`) when non-empty. `GripVertical` icon in header. While dragging another card, this card dims (`opacity-50 scale-[0.98]`).

### Player Row

The atomic list item in the PlayerPoolColumn — used for both queue entries and bench entries. Height minimum 44px (`min-h-[44px]`), full-width, `border-b border-border/40`.

**Queue row**: Left area: `GripVertical` (10px, `text-muted/60`) + position number (JetBrains Mono, 10px, right-aligned in a fixed `w-5` slot). Center: first name (14px, `text-ink`) + SkillBadge + optional "Matched" badge (`bg-primary/10 text-primary`, pill). Right: game count (JetBrains Mono, 10px `text-muted`) + controls.

**Bench row**: Same as queue but no grip or position number (bench is unordered). "Bench" entries have no position slot.

**Controls (hover-revealed)**: `opacity-0 group-hover:opacity-100`, visible at all times on touch (`[@media(hover:none)]:opacity-100`). Queue rows show: PauseCircle (move to bench) + `×` (remove). Bench rows show: PlayCircle (return to queue bottom). The PauseCircle/PlayCircle pairing is symmetrical — same icon style, same positioning, opposite semantics.

**Remove confirm**: `×` click enters confirm mode via `AnimatePresence mode="wait"` cross-fade to Check + `×` pair. Check executes removal; `×` cancels. Duration 120ms. This prevents accidental removal without adding a modal.

**"Playing" state**: Players currently in an active match are hidden from the queue list entirely — court/match state is client-side only and not yet a shared store other pages (Players, Sessions) can read, so an in-match player simply isn't visible anywhere off the Dashboard until they return to the queue. Not a deliberate filter; a known gap (see `docs/specs/08-sessions.md`). A "Playing" informational badge exists for legacy contexts (`text-muted bg-surface-elevated`, not the accent color — it's a status-of-fact, not an action).

### Session Row

The navigable table row on `/sessions` — a different interaction model from Player Row (no drag, no hover-reveal controls): the entire `<tr>` is the click/keyboard target (`onClick`, `tabIndex={0}`, `role="row"`, `onKeyDown` for Enter/Space), not an inline link inside one cell. Hover and focus share one treatment (`bg-surface-elevated/40`) so the affordance matches what's actually clickable — a row that only responds to a link buried inside it, while the whole row visually hovers, is the wrong version of this component. Every session-history table (list and detail) also sets `scope="col"` on every header cell; this is non-negotiable baseline semantics, not a nice-to-have.

### Toast / Undo Notification

A rounded-full pill (`rounded-full`, `bg-surface-elevated border border-border`, `px-4 py-2.5`, `shadow-lg`) fixed to the bottom center of the viewport, above the mobile bottom bar. Every reversible action across the app (queue removal, court assignment, card changes, player removal) confirms through this one shape — never a separate toast design per feature.

Leads with a `success`-colored Check icon (12px), then the message in `text-ink text-xs font-medium`, then — only when the action has an undo — a `border-border` divider (`w-px h-3`) and an "Undo" text-action in `text-primary font-semibold`. Two timing/ARIA modes: with `onUndo`, 5000ms and `role="alert" aria-live="assertive"`; without it, 2500ms and `role="status" aria-live="polite"`. The longer timeout for undoable actions is deliberate — it's the difference between "FYI" and "you might want to act on this."

Extracted to `useToast()` + `<ToastViewport />` in `src/components/ui/Toast.tsx`, migrated onto every one of its three previously-independent implementations (Dashboard, Matches, Players). `showToast(message, onUndo?, undoLabel?)` — the third argument is a per-call `aria-label` for the Undo button (e.g. "Undo court assignment"), since the visible text is always just "Undo" but what's actually being undone varies by call site.

## 6. Do's and Don'ts

### Do:
- **Do** use Court Copper (`oklch(0.71 0.17 38)`) on exactly one primary action per screen region — Start Match, Assign to Court, Confirm, End Match.
- **Do** set all quantitative data (win rates, queue positions, amounts, counts, durations) in JetBrains Mono at 500 weight.
- **Do** keep the page background at exactly `oklch(0.09 0 0)` — no chroma, no tint.
- **Do** size all interactive elements at minimum 44×44px; primary session actions (Start Match, End Match, Assign to Court, Confirm) at minimum 44×44px with `py-2.5` or equivalent.
- **Do** use semantic colors only for state: Court Green for available/paid, Caution Amber for unpaid/warning, Steel Slate for in-progress/in-use.
- **Do** keep transitions at 150–250ms ease-out; motion conveys state changes only (button press, status update, panel slide). Wrap animated sections in `<MotionConfig reducedMotion="user">`.
- **Do** respect `prefers-reduced-motion`: the global CSS rule (`animation-duration: 0.01ms`, `transition-duration: 0.01ms`) handles this system-wide.
- **Do** use the two-step inline confirm pattern for all destructive actions. No modals for deletions — the confirm replaces the action in the same row at the same height.
- **Do** keep court picker and other contextual action pickers spatially anchored to the element that triggered them. Never render pickers in a column footer detached from the triggering card.
- **Do** move focus explicitly on every confirm-swap transition (to Cancel on entry, back to the trigger on exit). A ref pair, not React state — the swap unmounts the focused element.
- **Do** give every focusable element a `focus-visible:ring-2`, including bare inline-text actions — add `rounded-sm px-1 -mx-1` if there's no natural padding for the ring to sit in.
- **Do** use `bg-surface-elevated` (lightness, not shadow blur) as the depth signal for anything that needs to read as "lifted" in dark mode — hover, scroll position, or otherwise.
- **Do** set `scope="col"` on every `<th>` in every data table, no exceptions.

### Don't:
- **Don't** use generic SaaS blue-and-white palettes (`#0052CC` primary buttons, white card surfaces, enterprise-software visual language). Top Seed is a precision sports tool, not a Jira clone.
- **Don't** use warm-cream, sand, or beige backgrounds — the full warm-neutral band (OKLCH L 0.84–0.97, C < 0.06, hue 40–100) is prohibited regardless of what it's named. Notion-lite aesthetics, "soft dashboard" energy, and paper-toned UIs are the direct opposite of the director's bench.
- **Don't** use neon colors, high-chroma gradients, or sports-betting visual vocabulary. No glowing score counters, no animated flipping numbers, no intense purple/blue/green chroma overlays.
- **Don't** use neighborhood-club visual energy: clip-art icons, playful rounded fonts, rainbow badge colors, low-effort layout.
- **Don't** use sans-serif for numerical data. Win rates, queue counts, payment totals, match numbers, and elapsed times are always JetBrains Mono. This is not optional.
- **Don't** tint the page background with any warmth. `oklch(0.09 0.015 38)` is visually indistinguishable from the correct `oklch(0.09 0 0)` but is the exact anti-pattern — the hue belongs to the accent, not the canvas.
- **Don't** use side-stripe borders (`border-left` > 1px as a colored accent on cards or list items). Use a full border, a background tint, or nothing.
- **Don't** use gradient text (`background-clip: text`). Emphasis via weight (700) or size only.
- **Don't** apply box-shadow to cards or rows at rest. Tonal separation via the dark scale is sufficient; shadows at rest mean the component was ported from a light-mode system without adaptation.
- **Don't** ship placeholder chrome. Disabled buttons for unbuilt features ("coming soon" tooltips) erode organizer trust. If a feature isn't built, the button doesn't exist yet.
- **Don't** use the centered icon-in-circle + heading + CTA empty state template. It's the most common AI-generated empty state. Use a single plain text line + minimal CTA instead.
- **Don't** use the accent color (Steel Slate) for status-of-fact badges like "Playing." Reserve accent for interactive signals (in-progress matches, navigational highlights). Informational-only states use `text-muted bg-surface-elevated`.
- **Don't** use `focus-visible:underline` as a substitute for a ring, even on dense inline text inside a toast or pill. It's a deprecated pattern in this system, not a legitimate secondary convention — every instance of it has been migrated to a padded ring.
- **Don't** "fix" a dark-mode shadow by tinting its color instead of dropping it. If a shadow is invisible against `oklch(0.09 0 0)`, the answer is `bg-surface-elevated`, never a lighter-colored shadow.
- **Don't** make a table row look hoverable everywhere but only respond to a link buried in one cell. If the row highlights on hover, the whole row is the click target.
