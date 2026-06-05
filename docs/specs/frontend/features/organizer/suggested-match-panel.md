# SuggestedMatchPanel / NextQueuePanel

## User Job

Help the organizer stage the next lined-up badminton matches before they move onto courts.

This feature should evolve from a single suggestion panel into a `NextQueuePanel`: a visible staging lane inspired by physical pegboards. It may still use auto-queue suggestions, but the organizer should see and edit multiple upcoming matches when space allows.

## Data Required

- Ordered queued matches.
- Team one and team two for each queued match.
- Team average ratings when useful.
- Explanation text for auto-filled matches.
- Warnings for unpaid players, repeat partners, recent rest, incomplete match slots, or no open court.
- Open courts for assignment.
- Local session snapshot for offline suggestion generation.

## Child Components

- `MatchCard`
- `PlayerRow`
- `StatusBadge`
- `Button`
- `Select`
- `Drawer`
- `SyncStatusBadge`

## Actions Emitted

- `onAcceptSuggestion`
- `onAutoFillNextQueue`
- `onRegenerateSuggestion`
- `onSwapPlayer`
- `onSwapTeams`
- `onManualAssign`
- `onMoveQueuedMatchToCourt`
- `onRemoveQueuedMatch`
- `onAddQueuedMatch`

## Permissions

- Suggestions and assignments require organizer permission.

## States

- Loading suggestion.
- Empty next queue.
- One or more queued matches ready.
- Queued match partially filled.
- No suggestion because too few players.
- No suggestion because no open court.
- Suggestion warning.
- Assignment loading or error.
- Offline suggestion generated from local state.
- Accepted suggestion pending sync.

## Responsive Composition

- Mobile: show first queued match and primary action first, with additional queued matches collapsed below.
- Tablet: keep visible beside `CourtBoard`.
- Desktop: right-side staging column with multiple queued match cards.

## Acceptance Criteria

- Auto-filled matches explain themselves in plain language.
- The next queue can show multiple lined-up matches when space allows.
- Organizer can override or manually assign.
- Moving a queued match to court requires court selection when multiple courts are open.
- `Magic Queue` / auto-fill can populate the next queue from available local players.
- Suggestions remain available offline when enough local session data exists.
- Drag-and-drop may be supported, but accessible button/menu alternatives are required.
