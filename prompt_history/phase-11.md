# Phase 11 — Desktop pegboard drag-and-drop

Implement **Phase 11 in sub-phases (11A → 11D)**. Each sub-phase is a shippable increment. **Do not skip 11A** — drag must call the same mutations as buttons.

Primary contract: `docs/specs/frontend/features/organizer/desktop-drag-and-drop.md`.

Do **not** change backend API, sync action catalog, or Dexie schema. Do **not** require drag on mobile. Do **not** auto-start matches on drop.

## Product context

Top Seed is an organizer-only, local-first badminton pegboard app. Phases 6–10 delivered functional queueing and immersive desktop layout. Phase 11 adds **desktop drag-and-drop as progressive enhancement** using `dnd-kit`.

**Prerequisites:**

| Phase | Delivers |
|-------|----------|
| **6** | Pegboard, `moveQueuedMatchToCourtLocal`, queue lanes |
| **8–9** | Sync replay parity |
| **10** | `PegboardLayout`, compact cards, immersive workspace bar |

**North star:** Move tokens Available → Next → Court on laptop without new business logic — only new interaction layer.

## Specs to read first (in order)

1. `AGENTS.md`
2. `docs/specs/frontend/features/organizer/desktop-drag-and-drop.md` — **primary contract**
3. `docs/specs/frontend/frontend-stack.md` — § Drag And Drop
4. `docs/specs/backend/state-transitions.md` — check-in and queued match transitions
5. `docs/specs/backend/sync-actions.md` — `UPDATE_QUEUED_MATCH`, `MOVE_QUEUED_MATCH_TO_COURT`
6. `docs/specs/frontend/features/organizer/live-dashboard-layout.md`
7. `docs/specs/frontend/features/organizer/queue-lane-management.md`
8. `docs/specs/frontend/features/organizer/court-board.md`
9. `docs/specs/frontend/components/domain/player-card.md`, `match-card.md`, `court-card.md`

## Current gaps (fix in 11A)

| Gap | Today | Target |
|-----|-------|--------|
| Fill queued slot | No UI to add player to draft match | `addPlayerToQueuedSlot` action + slot menu |
| `updateQueuedMatchLocal` | Exists in mutations, not in dashboard actions | Expose via `useSessionDashboard` |
| Send to court | Always uses `openCourtIds[0]` | Court picker when multiple open courts |
| Drag | Not implemented | 11B–11D |
| `CREATE_MATCH` direct to court | Not in web mutations | Phase **11E** stretch only |

## Tech choices (locked)

| Area | Choice |
|------|--------|
| Package | `apps/web` only |
| Library | `@dnd-kit/core`, `@dnd-kit/utilities`; `@dnd-kit/sortable` for 11D lane reorder only |
| Gating | `useDesktopDragDrop()` — `lg` + `pointer: fine` + live session + no `prefers-reduced-motion` |
| Logic | `resolvePegboardDrop.ts` — single resolver; components stay thin |
| Mutations | Reuse `updateQueuedMatchLocal`, `moveQueuedMatchToCourtLocal`, etc. |
| Provider | `DesktopDndProvider` wraps pegboard in `SessionDashboardPage` only |
| Testing | Vitest; unit-test resolver; component tests with DnD mocked or disabled |

**Do not use:** react-beautiful-dnd, react-dnd, custom HTML5 DnD without dnd-kit, new global state libraries.

## Suggested `apps/web` layout

```text
apps/web/src/
  features/dashboard/
    dnd/
      DesktopDndProvider.tsx
      useDesktopDragDrop.ts
      resolvePegboardDrop.ts
      resolvePegboardDrop.test.ts
      drag-types.ts
      DragOverlayPreview.tsx
    SessionDashboardPage.tsx    # wrap PegboardLayout on desktop
  hooks/
    useSessionDashboard.ts      # new actions: addPlayerToQueuedSlot, updateQueuedMatchParticipants
  components/domain/
    player-card.tsx             # drag handle + isDragging
    match-card.tsx              # droppable slots + draggable match
    court-card.tsx              # droppable court
  features/queue/
    QueueLaneManagement.tsx     # wire slot targets + fill menu
  package.json                  # add @dnd-kit/*
```

---

## Phase 11A — Button parity and dashboard actions

**Goal:** Every future drag path already works via buttons/menus.

### Tasks

1. Add `useSessionDashboard.actions`:
   - `addPlayerToQueuedSlot({ queuedMatchId, checkInId, team, slotOrder })`
   - `updateQueuedMatchParticipants({ queuedMatchId, participants })`
   - `moveQueuedMatchToLane({ queuedMatchId, targetQueueLaneId, sortOrder })` (for 11D)
2. `QueueLaneManagement` / `MatchCard`:
   - Empty slot menu: **Add player** → searchable list of `waiting`/`resting` check-ins.
   - Filled slot menu: **Remove from match** (updates participants).
3. **Send to court:** when `openCourtIds.length > 1`, show court picker (dialog or dropdown); keep single-court one-click.
4. Unit tests for `addPlayerToQueuedSlot` building correct participant shape and calling `updateQueuedMatchLocal`.

### Done when

- [ ] Organizer can fill a draft match to `ready` using menus only.
- [ ] Organizer can send ready match to chosen open court.
- [ ] No `dnd-kit` dependency yet.

---

## Phase 11B — DnD infrastructure

**Goal:** Install library, gate activation, provider shell, overlay — no production drops yet.

### Tasks

1. `pnpm --filter @top-seed/web add @dnd-kit/core @dnd-kit/utilities`
2. Implement `useDesktopDragDrop` and `DesktopDndProvider`:
   - `PointerSensor` activation distance `8`
   - `KeyboardSensor` for accessibility scaffolding
   - Return `enabled: false` on mobile / ended session / reduced motion
3. Wrap desktop `PegboardLayout` in `SessionDashboardPage` when `enabled`.
4. Add `drag-types.ts` (`DragItem`, `DropTarget`, ID helpers).
5. Stub `resolvePegboardDrop` returning `{ ok: false, reason: "Not implemented" }` for unhandled pairs.
6. `DragOverlayPreview` — renders `PlayerCard` compact ghost.
7. Tests: hook returns `enabled: false` on narrow viewport (mock `matchMedia`).

### Done when

- [ ] Provider mounts on desktop dashboard without breaking existing clicks.
- [ ] Drag handles visible on hover when enabled; no accidental drags on mobile.
- [ ] Build passes with dnd-kit installed.

---

## Phase 11C — P1 Player → queued match slot

**Goal:** Drag waiting player into empty `MatchCard` slot.

### Tasks

1. `PlayerCard`: `useDraggable` with id `player:{checkInId}`; grip handle; `isDragging` style.
2. `MatchCard`: `useDroppable` per empty slot id `slot:qm:{queuedMatchId}:{team}:{slotOrder}`.
3. Implement `resolvePegboardDrop` for P1 → calls `addPlayerToQueuedSlot`.
4. Highlight valid slots during drag (`ring-primary`).
5. Invalid drop messages per spec table.
6. `aria-live` region for drop outcomes.
7. Tests: resolver matrix; one integration test with Dexie + `updateQueuedMatchLocal`.

### Done when

- [ ] Desktop: drag player from Player List into empty draft slot stages match.
- [ ] Slot **Add player** menu still works (11A).
- [ ] Player `playing` not draggable.

---

## Phase 11D — P2 Ready match → open court

**Goal:** Drag full staged match onto open court.

### Tasks

1. `MatchCard` (`ready`): draggable id `queued-match:{id}`; handle on header.
2. `CourtCard` (`open`): droppable id `court:{courtId}`; highlight on valid drag-over.
3. Extend `resolvePegboardDrop` for P2 → `sendQueuedMatchToCourt`.
4. Reject incomplete matches, occupied courts, paused courts with user-visible reason.
5. Tests: resolver + court occupied rejection.

### Done when

- [ ] Desktop: drag ready match to open court assigns match locally.
- [ ] **Send to court** button still works.
- [ ] Match does not auto-start; **Start match** still required.

---

## Phase 11E — Stretch (optional follow-up)

Implement only after 11C–11D merged and stable.

| Item | Spec path |
|------|-----------|
| P3 swap/move between queued slots | `desktop-drag-and-drop.md` § P3 |
| P4 lane reorder | `moveQueuedMatchToLane` + `@dnd-kit/sortable` |
| P5 direct player → court slot | `createMatchLocal` + `CREATE_MATCH` + override messaging |

---

## Component contracts

### `useDesktopDragDrop()`

```ts
interface DesktopDragDropState {
  enabled: boolean;
}
```

### `resolvePegboardDrop`

```ts
type ResolveResult =
  | { ok: true; run: () => Promise<void> }
  | { ok: false; reason: string };

function resolvePegboardDrop(
  drag: DragItem,
  target: DropTarget,
  ctx: PegboardDropContext,
): ResolveResult;
```

### `PlayerCard` additions

```ts
dragHandleProps?: React.HTMLAttributes<HTMLElement>;
isDragging?: boolean;
draggable?: boolean; // false when playing or ended session
```

### `MatchCard` additions

```ts
queuedMatchId?: string;
droppableSlots?: boolean; // enables slot drop zones
draggable?: boolean; // true when status ready
```

### `CourtCard` additions

```ts
droppable?: boolean; // true when open and DnD enabled
isDropTarget?: boolean;
```

---

## Tests (cumulative)

| Sub-phase | New tests (approx) |
|-----------|-------------------|
| 11A | 5–8 (actions + slot fill) |
| 11B | 3–5 (gating, provider) |
| 11C | 6–10 (resolver P1, slot highlight) |
| 11D | 4–6 (resolver P2, court reject) |

Keep all Phase 6–10 tests passing.

---

## Manual validation (desktop ≥1280px)

Run after **11D**:

| # | Task | Success |
|---|------|---------|
| 1 | Drag waiting player into empty draft slot | 4th player → match shows ready |
| 2 | Drag ready match to Court 2 | Players appear on court; Start match available |
| 3 | Try drag to occupied court | Rejected with message; no state change |
| 4 | Same flows via buttons only (DnD disabled via narrow window) | Still works |
| 5 | Phone viewport | No drag handles; buttons work |

Qualitative: “Feels like moving pegs, not like a design toy.”

---

## Done when (full Phase 11)

- [ ] `desktop-drag-and-drop.md` acceptance criteria met for P1–P2
- [ ] `pnpm --filter @top-seed/web test` passes
- [ ] `pnpm --filter @top-seed/web build` succeeds
- [ ] `organizer-components.md` updated if new `DesktopDndProvider` registered
- [ ] Component specs cross-link `desktop-drag-and-drop.md`
- [ ] No new sync actions; no API changes
- [ ] Manual 5-task checklist completed

## Explicitly out of scope

- Mobile/tablet-required drag
- Drag on payments/history routes
- Player self-service, login
- Backend / sync catalog changes
- Auto-start match on drop
- P5 direct court assign (unless 11E explicitly scoped)

## Constraints for the implementer

- **One resolver** — do not scatter drop logic in `PlayerCard`, `CourtCard`, and page.
- **Same mutations as buttons** — if drag needs new behavior, add the mutation first, then wire both paths.
- If implementation diverges from spec, update `desktop-drag-and-drop.md` in the same PR.
- Prefer `DragOverlay` over transforming DOM nodes mid-layout.
- Hide drag handles when `!enabled` — do not only disable sensors.

## Prompt sequence (how to run)

Copy one block per session:

```text
Implement Phase 11A only per prompt_history/phase-11.md. Read desktop-drag-and-drop.md first. Button parity only — no dnd-kit.
```

```text
Implement Phase 11B only per prompt_history/phase-11.md. Infrastructure only — provider, gating, types, overlay stub. No production drops.
```

```text
Implement Phase 11C only per prompt_history/phase-11.md. P1 player → queued slot drag. Tests required.
```

```text
Implement Phase 11D only per prompt_history/phase-11.md. P2 ready match → open court drag. Tests required.
```

```text
Implement Phase 11E (stretch) per prompt_history/phase-11.md — only P3 slot swap OR P4 lane reorder OR P5 direct court; pick one scope per PR.
```

## Phase 12+ handoff notes

| Theme | Examples |
|-------|----------|
| **Realtime** | Multi-device dashboard refresh |
| **Tablet** | Optional coarse-pointer drag with larger handles |
| **Player-facing** | Self check-in routes |
| **PWA** | Install prompt, offline shell |
