# NextQueuePanel

Canonical feature spec for the pegboard **Next** zone. Desktop display label: **Upcoming Matches**.

Do not use `SuggestedMatchPanel` in new code or specs.

Related specs:

- Lane CRUD and move-to-court: `queue-lane-management.md`
- Assignment pipeline: `docs/specs/backend/queueing-and-ratings.md`
- State rules: `docs/specs/backend/state-transitions.md`
- Match card variants: `components/domain/match-card.md`

## User Job

Help the organizer stage the next lined-up badminton matches across one or more queue lanes before they move onto courts.

Visible staging lanes inspired by physical pegboards. The organizer should see and edit multiple upcoming matches when space allows, with suggestions as a helper—not hidden automation.

Parent composition: lives on the live dashboard beside `CourtBoard`. Composes `QueueLaneManagement` for lane CRUD, lane columns, and move-to-court actions.

## Panel Layout

The panel has two vertical regions, top to bottom:

### 1. Suggestion strip (global)

A single **Suggested next match** card sits **above** all lane columns. It is a preview only—not a lane and not on a court.

Shows:

- Four player slots in Team 1 / Team 2 layout.
- Plain-language explanation of why this grouping was chosen.
- Informational warnings (unpaid player, repeat partner, recent rest, duplicate staging elsewhere).
- When no court is open: still show the suggestion with a warning such as `All courts busy — you can still add to Next queue`.
- When too few eligible players: empty state such as `Need at least 4 waiting players for a suggestion`.

Primary actions on the suggestion card:

| Action | Label (recommended) | Effect |
|--------|---------------------|--------|
| Accept | `Add to [lane name]` or `Add to Next queue` when only one lane | `CREATE_QUEUED_MATCH` in the **selected lane** |
| Regenerate | `Regenerate` | Recompute top suggestion from current session state |
| Swap player | Per-slot control or menu | Replace one suggested player with another eligible player |
| Swap teams | `Swap teams` | Flip Team 1 and Team 2 pairings in the preview |

Rules:

- Accept never assigns a court.
- Regenerate affects only the global suggestion preview, not queued matches already in lanes.
- When `session.queueMode` is `manual`, hide the suggestion strip and show helper copy such as `Manual queue mode — build matches in Next lanes`.
- Swap player and swap teams work on the suggestion preview **and** on staged `MatchCard` rows in lanes (same interaction pattern).
- MVP has no separate **Auto-fill** action. Staging from the suggestion uses **Add to [lane]** only.

### 2. Queue lane columns

Rendered by `QueueLaneManagement` below the suggestion strip.

Each lane column shows:

- Lane name, queued-match count, sync status.
- Ordered `MatchCard` rows (`queued`, `queuedIncomplete`, or `ready`).
- Lane header actions: rename, delete, reorder, add empty match.
- Per-match actions: move to court, move to another lane, remove from queue, swap player, fill empty slot.

**Selected lane** is the target for accept and add-empty-match when the organizer has not picked another lane explicitly.

Selection rules:

- One lane is always selected when lanes exist.
- On mobile, the lane switcher tab marks the selected lane.
- On tablet/desktop, the focused column is selected; clicking a column header selects it.
- When only one lane exists, it is selected by default.

## Data Required

- Top suggestion: four players, teams, score explanation, warnings.
- Ordered queue lanes with selected lane id.
- Ordered queued matches grouped by lane.
- Team one and team two for each queued match.
- Team average ratings when useful.
- Queued match status: `draft`, `ready`, `promoted`, `removed`.
- Open courts for move-to-court and no-court warnings.
- Local session snapshot for offline suggestion generation.
- Sync status for queue lanes and queued matches.

## Child Components

- `QueueLaneManagement`
- `MatchCard`
- `PlayerRow`
- `StatusBadge`
- `Button`
- `Select`
- `Drawer`
- `DropdownMenu`
- `SyncStatusBadge`
- `EmptyState`

## Actions Emitted

Lane and queued-match actions are defined in `queue-lane-management.md`. This panel also emits:

- `onAcceptSuggestion` — `{ laneId }` required when multiple lanes exist; defaults to selected lane. Stages `CREATE_QUEUED_MATCH`; does not assign court.
- `onRegenerateSuggestion` — recomputes global preview only.
- `onSwapPlayer` — `{ context: 'suggestion' | 'queuedMatch', matchId?, playerId, replacementPlayerId }`.
- `onSwapTeams` — `{ context: 'suggestion' | 'queuedMatch', matchId? }`.
- `onManualAssign` — add or edit players in a `draft` queued match (`CREATE_QUEUED_MATCH` or `UPDATE_QUEUED_MATCH`).
- `onAddEmptyQueuedMatch` — `{ laneId }`; creates empty `draft` match in selected lane.
- `onDirectAssignToCourt` — override: `CREATE_MATCH`; show skipped-queue messaging. Not on the default suggestion card primary button.

- MVP footer actions on desktop pegboard: **Magic Queue** (accept suggestion into selected lane) and **Add Match** (empty draft in selected lane).
- `Magic Queue` maps to `onAcceptSuggestion`; label may read `Add to [lane]` when suggestion strip is visible.

Deprecated — not in MVP v1 (do not implement):

- `onAutoFillQueue`, `onAutoFillNextQueue`, `onAutoFillQueueLane`, `onAutoFillLane`
- UI labels **Auto-fill** (use **Magic Queue** instead on pegboard footer)

Deprecated component names (do not use in new code):

- `SuggestedMatchPanel` → use `NextQueuePanel`

## Manual Build (Draft Matches)

The organizer may stage incomplete matches in Next lanes.

Flow:

1. Tap `Add match` in a lane (or accept a partial manual build).
2. Empty slots render as `MatchCard` variant `queuedIncomplete` with labels such as `Needs player`.
3. Tap an empty slot → picker of eligible waiting/resting players from local session state.
4. Each added player sets check-in `queueStatus` to `assigned` per `state-transitions.md`.
5. When the fourth player is added, upgrade queued match from `draft` to `ready`.
6. Only `ready` matches may use **Send to court**.

Rules:

- Do not require four players before adding a match row to a lane.
- Incomplete matches may not be promoted to a court until `ready`.
- Same player may appear in multiple `draft`/`ready` matches across lanes; show an informational warning on affected cards, not a hard block.

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

- Suggestions and staging are available in live sessions.
- Hide assignment, accept, and lane mutation actions when the session is `completed` or `cancelled`.
- Read-only view may still show lanes and historical queued rows.

## States

**Suggestion strip**

- Loading suggestion.
- Suggestion ready with explanation.
- Suggestion with warnings (unpaid, repeat partner, rest, duplicate staging).
- Suggestion shown with **no open court** warning (staging still allowed).
- No suggestion — too few eligible players.
- Regenerating.
- Offline suggestion from local snapshot.
- Accept pending sync.

**Lane columns**

- No queue lanes yet (session bootstrap).
- Selected lane empty.
- One or more queued matches in selected lane.
- Multiple lanes with queued matches.
- Queued match partially filled (`draft`).
- Queued match ready (`ready`).
- Move-to-court loading or error.
- Queue lane mutation pending sync.
- Queue lane deletion confirmation.
- Queue lane deletion failed sync.

## Copy Guidelines

Default staging language (from `queueing-and-ratings.md`):

- Suggestion accept: `Add to [lane name]` or `Add to Next queue`.
- Promotion from lane: `Send to court` (not `Assign to court` for staged matches).
- Direct override elsewhere on dashboard: `Assigned directly — skipped Next queue`.
- Incomplete slot: `Needs 1 player` / `Needs 2 players`.
- Staged match from suggestion: optional `Suggested` badge on `MatchCard`.

## Responsive Composition

### Mobile (Next tab)

- Show the global suggestion strip at the top of the tab.
- Lane switcher below suggestion; one lane column visible at a time.
- Primary actions on staged `ready` matches: **Send to court** first.
- Lane CRUD in overflow menu per `queue-lane-management.md`.

### Tablet

- Suggestion strip spans the Next column width above lanes.
- Show two to three lane columns when width allows; selected lane visually emphasized.
- Keep `CourtBoard` and `NextQueuePanel` visible together on dashboard.

### Desktop

- Right-side staging column: suggestion strip on top, lane columns below.
- Multiple lane columns side by side; horizontal scroll when lanes exceed width.
- Selected lane: stronger header border or background token from design system.

## Accessibility

- Suggestion strip is a named region: `Suggested next match`.
- Selected lane is announced when focus moves between lane columns or tabs.
- Swap, accept, and send-to-court have button/menu alternatives; drag-and-drop is optional.
- Empty queued slots expose accessible names such as `Team 1 slot 2, empty`.

## Acceptance Criteria

- Global suggestion card appears above all lane columns.
- **Add to [lane]** is the only action that stages the suggestion; it targets the **selected lane** and does not assign a court.
- No **Auto-fill** button or `onAutoFillQueue` in MVP v1.
- Regenerate updates only the suggestion preview.
- Swap player and swap teams work on suggestion preview and staged queued matches.
- When all courts are busy, suggestion still shows with a clear warning; accept remains enabled.
- Unpaid players may appear in suggestions; warnings are informational only.
- Organizer can add empty `draft` matches and fill slots one at a time until `ready`.
- Incomplete queued matches cannot be sent to court.
- `ready` matches require court selection when multiple courts are open.
- Send to court requires organizer confirmation even when the UI pre-selects a court.
- Direct court assignment is never the primary button on the suggestion card.
- Multiple lanes, rename, reorder, delete, and move-between-lanes behave per `queue-lane-management.md`.
- Deleting a non-empty lane requires confirmation; final lane cannot be deleted.
- Same player in multiple staged matches shows a warning, not a block.
- Suggestions work offline from local session snapshot.
- Drag-and-drop may be supported; button and menu paths are required.
