# Frontend Design System Spec

## Design North Star

Top Seed should feel like a calm courtside control board for badminton organizers. The interface should help a queue master answer the next operational question quickly: who is here, who has paid, which court is free, who plays next, and what just finished.

The product should not feel like a generic SaaS dashboard with sports words pasted onto it. It should feel practical, warm, and specific to badminton open play: readable on a phone in a bright hall, dense enough for an organizer running six courts, and steady enough to use while people are asking questions in person.

MVP v1 is organizer-only. See **Future version: player surfaces** below for deferred player UI guidance.

For implementation details such as CSS units, typography tokens, spacing tokens, breakpoints, touch targets, styling conventions, motion, and formatting, use `docs/specs/frontend/frontend-technical-standards.md`.

Design personality:

- Practical, not flashy.
- Warm and human, not sterile.
- Sport-aware, not gimmicky.
- Fast under pressure, not overloaded.
- Trustworthy for payments and queue fairness.

## Audience Context

### Organizer context (MVP v1)

The queue master may run a live session from **phone, tablet, or desktop**. Do not assume they have a laptop. Many organizers will use only a phone at the hall.

Design for all three as **co-primary** live-session devices:

| Device | Typical use | Layout expectation |
|--------|-------------|-------------------|
| **Phone** (portrait) | Courtside default when no tablet or PC | Single column; pegboard zones via tabs or focused sections (see Mobile live dashboard) |
| **Tablet** (landscape) | Preferred pegboard view when available | `CourtBoard` and `NextQueuePanel` visible together when possible |
| **Desktop** | Full live operation or wider review at home/venue desk | Same workflows as phone/tablet; use extra width for context, not different features |

Organizer needs:

- Often standing near courts with a phone or tablet in hand.
- Switching between queueing, payment collection, player questions, and match results.
- Names, court numbers, and next actions readable at arm's length.
- Confidence that the app is fair, but still wants manual control.
- Large touch targets and one clear primary action per section on phone.

Environmental context:

- Badminton halls can be bright, noisy, and crowded.
- Network quality may be inconsistent.
- Touch targets matter more than pixel-perfect density.

**MVP rule:** optimize organizer workflows first on phone and tablet. Desktop must remain fully responsive and support the same live session operations; do not treat desktop as the only “real” dashboard.

### Future version: player surfaces

Not in MVP v1. When player self-service is added:

- Players may glance at status between rallies.
- They care about partner, opponents, court, payment status, and history.
- They should never need to understand the queue algorithm.

Do not design MVP organizer layouts around future player phone flows.

## Human-Centered Design Rules

- Every card must answer a real user question, such as `Who plays next?`, `Which court is free?`, `Who has not paid?`, or `What just finished?`.
- Use badminton context through layout, wording, and rhythm rather than decorative shuttle icons everywhere.
- Make status, time, and action hierarchy consistent across every screen.
- Prefer domain-specific labels such as `Court 3`, `Waiting`, `Resting`, and `Mark paid` over abstract dashboard labels.
- Keep organizer overrides visible and easy. The system suggests; the queue master decides.
- Do not add decorative UI that does not improve courtside decisions.
- Offline and sync states must be visible without creating panic. The organizer should know whether work is saved locally, syncing, synced, or needs attention.

## Pegboard Mental Model

The live session dashboard should be inspired by physical badminton pegboard systems. This is workflow evidence, not decoration. Pegboards work because they make the organizer's operating model visible:

- `Available`: players with `waiting` or organizer-marked `resting`. Players with `assigned` or `playing` appear on Next-lane and court cards instead.
- `Next`: one or more queue lanes with lined-up matches ready to move onto an open court.
- `Now`: courts with occupied team slots and current match state.

Players return to `waiting` in Available immediately after match completion. `resting` is organizer-initiated only and is not applied automatically after a match ends.

Players should feel like movable tokens. Courts should feel like spatial containers with Team A and Team B slots. The next queue should feel like a staging lane, not a hidden algorithm result.

Rules:

- On **tablet and desktop**, keep `CourtBoard`, `NextQueuePanel`, and `PlayerPool` visible together when possible.
- On **phone**, the full pegboard cannot fit on one screen. Use **Mobile live dashboard** (below); do not cram three pegboard zones into one unreadable scroll.
- Court cards must show players by team slot, not as a flat list.
- Next queue should show multiple lined-up matches and multiple queue lanes when space allows.
- Drag-and-drop may be supported on desktop; every drag action needs an accessible button/menu alternative on phone and tablet.
- Use court layout, queue movement, and player-token behavior as the badminton context. Avoid decorative shuttle graphics as the main visual identity.

### Mobile live dashboard (organizer phone)

When the organizer has only a phone, recommend **bottom tabs** so each pegboard zone stays glanceable:

| Tab | Pegboard zone | Default? | Why |
|-----|---------------|----------|-----|
| **Now** | Courts, start/finish match | **Yes** | Active courts are the first question: who is playing, who is free, what needs finishing |
| **Next** | Queue lanes, send to court, add suggestion to queue | No | Staging the next games; second-most frequent courtside task |
| **Available** | Player pool, check-in, waiting/resting | No | Walk-ins and queue adjustments |
| **More** | Payments, sync issues, recent matches, session actions | No | Exceptions and review; not the main loop |

Rules:

- Default to **Now** when opening the live dashboard on phone.
- Show offline/sync banner above tabs when relevant; it must not block court actions.
- Do not require drag-and-drop on phone. Use explicit buttons: `Send to court`, `Start match`, `Add to next match`.
- Keep one primary action visible per tab section (for example `Finish match` on Now, `Send to court` on Next).
- If MVP ships without tabs, use a single-column stack in this order: sync state → **Courts (Now)** → **Next queue** → quick check-in → player pool → payment exceptions → recent matches. Prefer adding tabs before adding more single-scroll density.

## Anti-Patterns

Avoid visual patterns that make the app feel AI-generated or generic:

- Random gradient cards that do not encode meaning.
- Excessive glow, glassmorphism, shadows, or neon sports styling.
- Dashboard cards with vague labels such as `Performance`, `Insights`, or `Engagement`.
- Icons used as decoration without labels.
- Table-heavy mobile screens.
- Over-gamified rankings that make casual sessions feel hostile.
- Color systems where every badge uses a different unrelated hue.
- Empty states that sound like templates, such as `No data found`.
- Queue explanations that expose implementation terms like `candidate score` or `mutation`.
- Copy that overpromises automation or fairness beyond what the algorithm can explain.
- Layouts where payments, stats, or generic metrics dominate the courts and next queue.

## Visual Personality

Borrow from badminton and club operations without copying literal sports branding:

- Court lines: use subtle dividers, lanes, and grouped regions to organize dashboard zones.
- Scoreboards: make court numbers, team names, and match states large and glanceable.
- Club noticeboards: use clear labels, plain summaries, and human notes.
- Shuttle motion: use restrained transitions for state changes, not constant animation.
- Match cards: visually pair partners and opponents so team structure is obvious.

The app should feel like it belongs in a real community sports hall, not a crypto dashboard, fantasy game, or enterprise BI tool.

## Reference-Inspired Card System

Borrow card chrome from modern queueing dashboards (soft white cards, pill badges, avatar initials) while keeping Top Seed domain language and tokens.

Allowed:

- Avatar initials circles on player tokens.
- Pill status badges (`Queued #1`, skill level, payment state).
- Nested mini-cards inside match and court team columns.
- Zone footers with one primary and one secondary action (`Magic Queue`, `Add Match`, `Start Match`).
- Lighter borders (`border-border/60`), consistent `shadow-sm`, slightly rounder `--radius-card`.

Still forbidden:

- Vague analytics tiles (`Performance`, `Insights`).
- Decorative gradients and glassmorphism.
- Pixel-perfect copy of reference brand colors.

Adapt mood into existing semantic tokens (`surface`, `court`, `next`, `attention`) — do not import a third-party palette wholesale.

## Aesthetic Direction

The visual feel should borrow from premium sports, wellness, and club interfaces while staying practical for courtside operations.

Target qualities:

- Soft off-white or warm gray app background.
- Rounded modular cards with generous spacing.
- Deep green court surfaces for `Now` states.
- Charcoal or near-black surfaces for high-emphasis status panels when needed.
- Warm orange/yellow accents for `Next`, active attention, and queued-match highlights.
- Light borders, subtle shadows, and quiet dividers.
- Large numeric/status typography only where it improves scanning.
- Clean iconography with text labels for important actions.
- Sport imagery or texture used sparingly outside the live operation surface.

Operational mapping:

- `Available`: light cards, compact player-token rows, payment/wait metadata.
- `Next`: warm-highlighted queue lanes, staged match cards, visible **Add to [lane]** on the suggestion strip.
- `Now`: deep green or court-line inspired court containers with Team A / Team B slots.
- `Needs attention`: warm warning treatment for unpaid, sync failed, or incomplete match slots.

Rules:

- Operational clarity beats decorative imagery.
- The live dashboard should feel custom and sports-specific, but not visually loud.
- Use color to reinforce hierarchy, not to create a rainbow dashboard.
- Court and queue surfaces may be more expressive than settings or history pages.
- Do not copy reference images pixel-for-pixel; borrow mood, spacing, card rhythm, and contrast.

## Color Strategy

Use semantic color first, brand color second.

Recommended semantic roles:

- `brand`: primary actions and selected navigation.
- `surface`: app background, panels, cards, raised controls.
- `text`: primary text, secondary text, muted metadata.
- `border`: card boundaries, dividers, court lane separators.
- `success`: paid, open court, completed positive action.
- `warning`: unpaid, partial payment, needs attention.
- `danger`: destructive actions, cancelled state, blocking errors.
- `info`: assigned, in progress, neutral system update.

Rules:

- Do not use color alone to communicate status. Pair it with text or iconography.
- Avoid rainbow dashboards. Similar concepts should share a family of colors.
- Keep payment warnings more visually prominent than decorative brand accents.
- Use softer fills for badges and stronger color only for primary actions or urgent states.
- Validate color contrast in both light and dark themes if dark mode is introduced.

## Typography And Density

Text hierarchy should match courtside decision-making:

- Largest: court numbers, active match teams, current player status.
- Medium: player names, primary actions, queue section headings.
- Small: rating, wait time, match count, payment notes, timestamps.

Rules:

- Player names must remain readable on mobile and tablet.
- Avoid tiny all-caps labels for important status.
- Use tabular numbers for scores, court numbers, payment amounts, and timers when available.
- Keep metadata compact, but do not hide it behind hover-only UI.
- Let long player names wrap or truncate predictably with a detail view available.

## Spacing And Layout

All breakpoints must support the **full organizer live session** (check-in, queue, courts, payments, results). MVP is not a “phone-lite” subset.

Mobile (organizer phone):

- Co-primary device; assume no laptop at the hall.
- Single-column flows or bottom-tab pegboard zones (see Mobile live dashboard).
- One primary action per screen section.
- Use drawers or bottom sheets for short forms.
- Avoid dense grids and wide tables.
- Player names and court numbers must stay readable in portrait.

Tablet (organizer):

- Co-primary device; ideal pegboard layout.
- Keep `CourtBoard` and `NextQueuePanel` visible together when possible.
- Use multi-column dashboard zones for courts, queue, payments, and recent matches.
- Make touch targets comfortable enough for standing use.

Desktop (organizer):

- Co-primary device; same live workflows as phone and tablet.
- Must remain responsive; do not design desktop-only features for MVP live operation.
- Use extra width to show more context side by side, not to add different workflows.
- Let summaries, history, and payment panels sit beside operational panels when width allows.

Dashboard layout should prioritize:

1. `Now`: court state and occupied players.
2. `Next`: queue lanes and lined-up matches ready for assignment.
3. `Available`: waiting/resting players and quick check-in.
4. Payment exceptions.
5. Recent match history.

## Core UI Components

Build or standardize these reusable components:

- `Button`
- `IconButton`
- `Card`
- `StatusBadge`
- `PaymentBadge`
- `SyncStatusBadge`
- `OfflineBanner`
- `MetricCard`
- `CourtCard`
- `PlayerRow`
- `MatchCard`
- `Tabs`
- `Dialog`
- `Drawer`
- `Toast`
- `FormField`
- `Select`
- `SearchInput`
- `DataList`
- `EmptyState`
- `ConfirmAction`

## Component UX Standards

### Button

Purpose: trigger a clear action.

Use for:

- `Check in player`
- `Accept suggestion`
- `Start match`
- `Finish match`
- `Mark paid`

Rules:

- Primary buttons should be reserved for the most likely next action in that section.
- Destructive buttons should be visually distinct and require confirmation for high-impact actions.
- Loading buttons must keep their width stable and prevent double submission.

### StatusBadge

Purpose: make queue, court, payment, and match states scannable.

Rules:

- Always include readable text.
- Use consistent labels from `Status Badge Language`.
- Use color as reinforcement, not the only indicator.
- Avoid inventing one-off status labels in feature components.

### MetricCard

Purpose: summarize operational counts that help the organizer act.

Use for:

- Checked-in players.
- Waiting players.
- Open courts.
- Unpaid players.
- Collected amount.

Rules:

- Each metric must imply a decision or action.
- Avoid vanity metrics in the MVP.
- Link or filter to the relevant detail when tapped.

### DataList

Purpose: compact term/value rows in drawers and detail panels.

Spec: `docs/specs/frontend/components/primitives/data-list.md`.

Use for:

- Player detail drawer read-only rows.
- Sync review action metadata.
- Match detail summaries.

Rules:

- Pair with `FormField` when the row becomes editable.
- Use section headings when there are more than eight rows.

### DropdownMenu

Purpose: overflow menus for secondary lane, court, and row actions.

Spec: `docs/specs/frontend/components/primitives/dropdown-menu.md`.

Use for:

- Queue lane header actions.
- Court card overflow actions.
- Compact player row menus.

Rules:

- Do not hide the only path to a critical action inside a menu without a visible alternative.

### CourtCard

Purpose: show one court's current state and next available action.

Required content:

- Court name or number.
- Court status.
- Current teams if occupied.
- Primary action based on state.

Rules:

- Occupied courts must show teams as pairs, not a flat list of four names.
- Open courts should make assignment easy.
- Paused or unavailable courts should explain why if a note exists.

### PlayerRow

Purpose: show a player in queue, payment, or check-in lists.

Required content:

- Display name.
- Queue status.
- Session rating.
- Payment status.
- Wait time or match count when relevant.

Rules:

- Do not overload the row with every possible stat.
- Important exceptions such as unpaid or recently played should be visible.
- Secondary actions should sit behind a menu or detail drawer on mobile.

### MatchCard

Purpose: show assigned, active, or completed match details.

Required content:

- Court.
- Team one and team two.
- Match status.
- Score or result when available.

Rules:

- Team pairing must be visually obvious.
- Active match actions should be faster to reach than historical details.
- Cancelled matches should not look like completed results.
- Draws should read as neutral competitive outcomes, not wins for both teams.
- Unscored results should read as completed without competitive result.

### PaymentBadge

Purpose: make payment state visible without turning the whole UI into an accounting system.

Rules:

- `unpaid` and `partial` should be easy to spot.
- `paid` should be calm and low-friction.
- `waived` should look intentional, not like an error.
- Payment badges should link to payment details in live sessions; disable in ended sessions.

### EmptyState

Purpose: explain what is missing and what the user can do next.

Rules:

- Use specific copy, not `No data found`.
- Include one clear action when possible.
- Avoid illustrations unless they reinforce the task without adding clutter.

Examples:

- `No courts yet. Add courts to start building the session board.`
- `No players checked in. Search for a returning player or add a walk-in.`
- `No suggestion available. You need at least four waiting players and one open court.`

### Drawer

Purpose: support quick, focused edits without leaving the dashboard.

Use for:

- Player details.
- Check-in form.
- Payment update.
- Rating adjustment.

Rules:

- Prefer drawers for mobile and tablet side tasks.
- Preserve unsaved input if the user accidentally closes and reopens quickly.
- Keep drawer actions sticky at the bottom on mobile.

### Dialog

Purpose: interrupt only when the decision is important.

Use for:

- Confirming destructive actions.
- Completing a session.
- Cancelling a match.

Rules:

- Dialog titles should state the decision plainly.
- Body copy should explain consequence, not repeat the button label.
- Provide a safe cancel path.

### Toast

Purpose: confirm lightweight outcomes or show recoverable errors.

Rules:

- Toasts should be short and specific.
- Do not use toasts for information the user must act on later.
- For undoable actions, include `Undo` only when the backend supports it.

## Status Badge Language

Queue statuses:

- `waiting`: Waiting
- `assigned`: Assigned
- `playing`: Playing
- `resting`: Resting
- `done`: Done
- `removed`: Removed

Court statuses:

- `open`: Open
- `occupied`: In Use
- `paused`: Paused
- `unavailable`: Unavailable

Payment statuses:

- `unpaid`: Unpaid
- `partial`: Partial
- `paid`: Paid
- `waived`: Waived
- `refunded`: Refunded

Match statuses:

- `assigned`: Assigned
- `in_progress`: In Progress
- `completed`: Completed
- `cancelled`: Cancelled

Match outcomes:

- `team_one_win`: Team A Won
- `team_two_win`: Team B Won
- `draw`: Draw
- `unscored`: Unscored

Connection and sync statuses:

- `online`: Online
- `offline`: Offline
- `local`: Saved on this device
- `pending`: Pending sync
- `syncing`: Syncing
- `synced`: Synced
- `failed`: Sync failed

Connection copy:

- Use `Offline. You can keep running this session.`
- Use `Saved on this device. Will sync when online.`
- Use `Sync failed. Review and retry.`
- Avoid `Data lost`, `Fatal sync error`, or other alarming copy unless data is truly unrecoverable.

## Action Hierarchy

Primary actions:

- Check in player.
- Accept suggestion.
- Assign court.
- Start match.
- Finish match.
- Mark paid.

Secondary actions:

- Edit rating.
- Regenerate suggestion.
- Swap player.
- Pause court.
- View details.

Destructive actions:

- Remove player.
- Cancel match.
- Cancel session.

Destructive actions require confirmation unless they are easily reversible and low impact.

## Forms

Form rules:

- Use short forms for courtside actions.
- Show validation near the field.
- Preserve typed input after errors.
- Use sensible defaults such as rating `3.0` and session fee from the session.
- Put the most likely field first.
- Avoid asking for information that is not needed to run the current session.

Key MVP forms:

- Player check-in.
- Add player.
- Edit session rating.
- Mark payment.
- Record match result.
- Add or pause court.

## Empty States

Every major panel needs an actionable empty state:

- No courts: prompt to add courts.
- No players: prompt to check in players.
- No suggestion: explain whether there are too few players or no open courts.
- No payments: explain that payment tracking starts after check-in.
- No match history: show that completed matches will appear there.

## Content Voice

Use direct, calm, human language.

Good labels:

- `Mark paid`
- `Finish match`
- `Assign to Court 2`
- `Player is already checked in`
- `Waiting for one more player`

Avoid labels:

- `Execute payment state mutation`
- `Resolve queue candidate`
- `Optimize allocation`
- `No data found`
- `Engagement metrics`

Suggestion explanations should be transparent but not technical:

- `Suggested because these four players have waited longest and the teams are closely balanced.`
- `Skipped two players who just finished a match.`
- `No suggestion yet. You need at least four waiting players and one open court.`

Payment copy should be careful:

- Use `Mark paid`, not `Charge`.
- Use `Payment tracked manually`, not `Payment processed`.
- Use `Waive fee`, not `Free player`.

Offline copy should reassure and guide:

- `Offline. You can keep running this session.`
- `3 changes pending sync.`
- `All changes synced.`
- `Sync failed for 1 payment update. Review and retry.`

## Offline UI Rules

- Show a persistent but compact offline banner when the app is disconnected.
- Show pending sync indicators near affected records when useful, such as payment rows, match cards, or court actions.
- Do not block organizer actions only because the app is offline.
- Avoid modal interruption for normal offline mode.
- Use stronger warning treatment only when a sync action fails or local storage is at risk.
- Keep failed sync recovery actionable: review and retry via `SyncReviewPanel`.
- **Export session backup** is deferred past MVP v1 (see Local backup below).
- Warn before clearing browser data when unsynced changes exist.

### Local backup (MVP stance)

MVP v1 does **not** ship an organizer-facing export/download button.

Rules:

- Recovery path: fix connectivity → **Retry** / **Retry all failed** in `SyncReviewPanel`.
- Do not promise export in UI copy until a backup format is specified.
- `OfflineBanner` and sync review must not show **Export backup** in MVP.
- Future versions may add a downloadable JSON (or similar) snapshot of local session + outbox; spec the format before exposing the control.

When export ships later:

- Include session entities, check-ins, matches, payments, outbox, and sync cursor metadata.
- Exclude secrets; use same IDs as sync replay for reconciliation.

See `docs/specs/frontend/features/organizer/sync-review-panel.md`.

## Reference Screenshot Workflow

Store design inspiration in:

- `docs/reference/screenshots/`

Recommended folders:

- `docs/reference/screenshots/queue-dashboard/`
- `docs/reference/screenshots/check-in-flow/`
- `docs/reference/screenshots/payments/`
- `docs/reference/screenshots/player-status/`
- `docs/reference/screenshots/leaderboard/`

Each group of screenshots should include a short notes file that captures:

- What works.
- What does not fit badminton open play.
- Which interaction pattern is worth borrowing.
- Which visual details should not be copied.

Rules:

- Borrow principles, not pixels.
- Do not copy a competitor's layout wholesale.
- Do not add screenshots to app asset folders unless they are actual product assets.
- Use screenshots to inform component behavior and hierarchy before choosing colors.

## Accessibility And Usability

- Minimum touch target size should be comfortable for mobile use.
- Do not communicate status by color alone.
- Use readable font sizes for names and court numbers.
- Support keyboard navigation for desktop users.
- Provide loading states for all network actions.
- Keep critical workflows usable with intermittent network updates.
- Make errors recoverable without losing form input.
- Avoid hover-only controls for organizer workflows.
