# Desktop Drag and Drop (Pegboard)

## Purpose

Define **optional desktop drag-and-drop** for the live session dashboard pegboard. Drag is a **speed layer** for laptop/desktop organizers; buttons and menus remain the canonical, accessible assignment path.

Read first:

- `docs/specs/frontend/design-system.md` — pegboard mental model
- `docs/specs/frontend/features/organizer/live-dashboard-layout.md` — three-zone layout
- `docs/specs/frontend/frontend-stack.md` — `dnd-kit` as enhancement only
- `docs/specs/backend/state-transitions.md` — queue status side effects
- `docs/specs/backend/sync-actions.md` — mutation catalog (no new sync actions for DnD)

**Out of scope:**

- Mobile/tablet-required drag
- Drag-only workflows (no button alternative)
- New backend endpoints or sync action types
- Drag on payments, history, or session sub-routes
- Auto-starting a match on drop (organizer still taps **Start match**)

## North Star

The organizer should be able to **move player tokens like a physical pegboard** on desktop: Available → Next slot → Court. Every drop calls the **same local mutations** as the existing button flows and enqueues the same sync actions.

```text
Available (Player List)  --drag-->  Next match slot  --drag-->  Open court
         ^                                                    |
         +---------------- after result / remove -------------+
```

## Activation Rules

| Condition | Drag enabled? |
|-----------|---------------|
| Viewport `lg` (≥1024px) and fine pointer (`pointer: fine`) | Yes |
| Phone / tablet portrait, coarse pointer | No — buttons only |
| Session `completed` or `cancelled` | No |
| `prefers-reduced-motion: reduce` | No — buttons only |
| Player `playing` on an in-progress match | Not draggable from pool |
| Court `paused` or `unavailable` | Not a valid drop target |

Detect capability in one hook: `useDesktopDragDrop()` → `{ enabled: boolean }`. Gate sensors and drag handles on `enabled`.

## Library

Use `@dnd-kit/core`, `@dnd-kit/sortable` (lane reorder stretch only), and `@dnd-kit/utilities`.

Install in `apps/web` only. Do not add a second drag library.

## Drag Sources and Drop Targets

### Canonical drag data (`DragItem`)

Every draggable item carries a typed payload:

```ts
type DragKind =
  | "player"           // waiting/resting check-in from Player List
  | "queued-match"     // ready queued match card (promote to court)
  | "queued-player";   // player already in a staged match (re-slot / swap)

interface DragItem {
  kind: DragKind;
  sessionId: string;
  checkInId?: string;
  queuedMatchId?: string;
  playerProfileId?: string;
  sourceZone: "available" | "next" | "court";
}
```

### Canonical drop targets (`DropTarget`)

```ts
type DropKind =
  | "queued-slot"      // team + slot on a draft/ready queued match
  | "court"            // open court accepting a ready queued match
  | "court-slot";      // team + slot on open/partial court (stretch)

interface DropTarget {
  kind: DropKind;
  sessionId: string;
  queuedMatchId?: string;
  courtId?: string;
  team?: "team_one" | "team_two";
  slotOrder?: 1 | 2;
}
```

Stable string IDs for `useDraggable` / `useDroppable`:

| Entity | ID pattern | Example |
|--------|------------|---------|
| Player token | `player:{checkInId}` | `player:check-in-1` |
| Queued match card | `queued-match:{queuedMatchId}` | `queued-match:qm-1` |
| Queued slot | `slot:qm:{queuedMatchId}:{team}:{slotOrder}` | `slot:qm:qm-1:team_one:1` |
| Court (match drop) | `court:{courtId}` | `court:court-2` |
| Court slot (stretch) | `slot:court:{courtId}:{team}:{slotOrder}` | `slot:court:court-2:team_two:2` |

## Supported Drop Paths (MVP DnD)

Implement in priority order. Each path lists mutation, validation, and button twin.

### P1 — Player → empty queued match slot

| | |
|--|--|
| **User job** | Stage a waiting player into a draft match in Upcoming Matches |
| **From** | `PlayerCard` in Player List (`queueStatus` `waiting` or `resting`) |
| **To** | Empty slot on `MatchCard` (`queuedIncomplete`) |
| **Mutation** | `updateQueuedMatchLocal` — append participant with `team` + `slotOrder` |
| **Sync** | `UPDATE_QUEUED_MATCH` |
| **Validation** | Player not `playing`; slot empty; match `draft` or `ready`; max 4 participants; player not duplicated in same match |
| **Button twin** | Slot overflow → **Add player** → picker (implement in Phase 11A if missing) |
| **On success** | Player `queueStatus` → `assigned`; match status recalculates (`draft` → `ready` at 4) |

### P2 — Ready queued match → open court

| | |
|--|--|
| **User job** | Send a staged doubles match to a free court |
| **From** | `MatchCard` with `status === "ready"` (drag handle on card header) |
| **To** | `CourtCard` with UI status `open` (drop highlight on whole card) |
| **Mutation** | `moveQueuedMatchToCourtLocal` |
| **Sync** | `MOVE_QUEUED_MATCH_TO_COURT` |
| **Validation** | Match `ready`; court open; no active match on court; court not paused/unavailable |
| **Button twin** | **Send to court** (existing; improve court picker when multiple open) |
| **On success** | Match on court `assigned`; court `occupied`; queued match `promoted` |

### P3 — Player between queued slots (swap / move)

| | |
|--|--|
| **User job** | Fix team placement without removing the match |
| **From** | Filled slot on staged `MatchCard` |
| **To** | Another empty or occupied slot on **same** queued match |
| **Mutation** | `updateQueuedMatchLocal` — replace participant positions |
| **Button twin** | Slot menu → **Move to Team B slot 1**, **Swap with…** |
| **Note** | Occupied target → swap slot assignments |

### P4 — Queued match reorder within lane (stretch)

| | |
|--|--|
| **From** | `MatchCard` in lane list |
| **To** | Gap between matches in same lane |
| **Mutation** | `moveQueuedMatchToLaneLocal` with new `sortOrder` |
| **Sync** | `MOVE_QUEUED_MATCH_TO_LANE` |
| **Button twin** | **Move up** / **Move down** on match overflow |

## Stretch (Phase 11E — after P1–P2 stable)

### P5 — Player → open court slot (direct assign)

| | |
|--|--|
| **User job** | Skip Next staging intentionally |
| **Mutation** | `createMatchLocal` → `CREATE_MATCH` (may not exist in web yet; implement mutation first) |
| **UX** | Show toast or inline note: **Assigned directly — skipped Next queue** |
| **Button twin** | Court slot menu → **Assign player** |
| **Validation** | Court open or partial; player `waiting`/`resting`; slot empty |

Do not implement P5 until P1 and P2 have tests and button parity.

## Invalid Drops (reject with reason)

Show a brief non-blocking message (toast or inline chip) — do not throw uncaught errors.

| Attempt | Message (example) |
|---------|---------------------|
| Player → full slot | `Slot is already filled` |
| Player → court while match in progress | `Finish the current match first` |
| Incomplete match → court | `Need 4 players before sending to court` |
| Match → busy court | `Court is occupied` |
| Player `playing` | `Player is on court` |
| Ended session | `Session is read-only` |
| Drop outside target | Snap back; no mutation |

## Visual and Interaction Design

### Drag handle

- Show **grip icon** on `PlayerCard` and ready `MatchCard` header on `lg+` when DnD enabled.
- Handle appears on **hover** or **focus-within** on desktop; card body is not the default drag surface (reduces mis-drags).
- `aria-grabbed` / `aria-dropeffect` on active drag.

### Drop zone highlighting

| Target state | Style |
|--------------|-------|
| Idle | Empty slots: subtle inset fill; dashed border only when DnD enabled or slot empty |
| Drag active, valid | `ring-2 ring-primary/40 bg-primary/5` |
| Drag active, invalid | `ring-2 ring-danger/30` (optional) |
| Court accepting match | Whole `CourtCard` body highlight when dragging `queued-match` |
| Ready staged match (idle) | Warm `next` border/accent on `MatchCard`; header drag handle on `lg+` |

### Staged match card (P2 source)

Ready `MatchCard` headers double as drag handles on desktop. Card body is not the drag surface. Pair with footer **Send to court** button — both call the same mutation.

Use `DragOverlay` with semi-transparent `PlayerCard` / `MatchCard` preview following pointer.

### Motion

- Short snap animation on drop (&lt;200ms).
- Respect `prefers-reduced-motion`: instant placement, no overlay animation.

## Architecture

### Provider placement

Wrap **desktop pegboard only** inside `SessionDashboardPage`:

```text
SessionDashboardPage
└── DesktopDndProvider (null children passthrough when disabled)
    └── PegboardLayout
        ├── PlayerPool (draggable players)
        ├── NextQueuePanel (droppable slots + draggable matches)
        └── CourtBoard (droppable courts)
```

Do not wrap payments, history, or mobile tab panels.

### Resolver module

Centralize drop logic in `apps/web/src/features/dashboard/dnd/resolvePegboardDrop.ts`:

```ts
resolvePegboardDrop(drag: DragItem, target: DropTarget, context: DashboardSnapshot): 
  | { ok: true; action: () => Promise<void> }
  | { ok: false; reason: string };
```

`context` includes session, check-ins, queued matches, courts, matches. The resolver calls existing mutation functions — **no duplicate business rules** in components.

### Dashboard actions to expose (Phase 11A prerequisite)

Add to `useSessionDashboard.actions` if missing:

| Action | Wraps |
|--------|--------|
| `updateQueuedMatchParticipants` | `updateQueuedMatchLocal` |
| `addPlayerToQueuedSlot` | builds participant array + `updateQueuedMatchLocal` |
| `moveQueuedMatchToLane` | `moveQueuedMatchToLaneLocal` |
| `sendQueuedMatchToCourt` | already exists |
| `createDirectCourtMatch` (stretch) | future `createMatchLocal` |

## Accessibility

- **Keyboard:** `KeyboardSensor` with sortable coordinates; slot targets focusable; **Move to…** menu always available.
- **Screen readers:** announce drop result via `aria-live="polite"` region.
- **Touch:** no drag on coarse pointers; existing buttons unchanged.

## Session Mode and Sync

- DnD disabled when session ended (same as buttons).
- Failed mutation → local state unchanged; show error message; drag overlay returns to source.
- Offline: drops still write locally and enqueue outbox (same as buttons).

## Component Updates

| Component | Change |
|-----------|--------|
| `PlayerCard` | Optional `dragHandleProps` from `useDraggable`; `isDragging` opacity |
| `MatchCard` | Droppable slots; draggable when `ready`; drag handle on header |
| `CourtCard` | `useDroppable` on card when `open`; optional per-slot droppable in stretch |
| `PegboardLayout` | No DnD logic — layout only |
| `QueueLaneManagement` | Wire slot drop targets; pass drag metadata |

Update component specs: `player-card.md`, `match-card.md`, `court-card.md` — reference this file for `dropTargets` / `dragHandleProps`.

## Testing

| Area | Examples |
|------|----------|
| `resolvePegboardDrop` | Valid/invalid matrix for P1–P2 |
| Unit | Player → slot builds correct `UPDATE_QUEUED_MATCH` payload |
| Component | Drop zone highlights when `enabled` |
| Integration | Drag player to slot updates Dexie + outbox (mocked) |
| Regression | Button paths still work when DnD disabled |
| a11y | Keyboard move menu performs same mutation |

Target **15–25** new tests across phases 11A–11D.

## Acceptance Criteria

- [ ] DnD only active on `lg+` fine pointer live sessions.
- [ ] P1: drag waiting player into empty queued slot stages match locally.
- [ ] P2: drag ready match onto open court promotes via `MOVE_QUEUED_MATCH_TO_COURT`.
- [ ] Every drag path has a working button/menu equivalent.
- [ ] Invalid drops never corrupt local state.
- [ ] Mobile and tablet workflows unchanged.
- [ ] No new sync action types.
- [ ] `pnpm --filter @top-seed/web test` and `build` pass.

## Related Specs

- `queue-lane-management.md` — lane and match actions
- `court-board.md` — court drop targets
- `next-queue-panel.md` — staging lanes
- `player-pool.md` — draggable player tokens
- `live-dashboard-layout.md` — pegboard zones (dashed slots activate on drag)

## Migration Note

`live-dashboard-layout.md` reserved dashed borders for future DnD. When DnD ships:

- **Idle:** solid subtle empty slots.
- **Drag active:** dashed or ring highlight on valid targets only.
