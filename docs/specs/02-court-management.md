# Spec: Court Management

## Scope
Track court availability and link courts to active matches. Courts are numbered automatically — no naming, no renaming. Courts are either Available or In Use. Unavailable courts are deleted.

---

## Data Model Notes (see ARCHITECTURE.md)
- `Court.number Int @unique` — auto-assigned as `max(number) + 1` on creation; gaps are fine after deletion
- `CourtStatus`: `AVAILABLE | IN_USE` only
- Courts are hard-deleted — no soft-delete
- `Match.courtId` is nullable (`onDelete: SetNull`); `Match.courtName` snapshots "Court N" at match creation

---

## Pages & Components

### `/courts` — Court Management Page

**Header bar:**
- Court count summary: "5 courts — 4 Available, 1 In Use"
- "Add Court" button — no dialog; calls `createCourt()` directly, new court appears instantly as "Court N"
- "Add Multiple Courts" button → `AddMultipleCourtsDialog` — number input (1–20); creates N courts in one action
- "Reset All to Available" button
- Multi-select mode toggle

**Court grid:**
- 2-col on mobile, 3-col on tablet, 4-col on desktop

### `CourtCard` — States

| Status | Card Style | Primary Action |
|---|---|---|
| Available | Green border | "Start Match" → `/matches/new?court=id` |
| In Use | Blue border + player names | "View Match" → `/matches/[id]` |

**Card actions menu (⋯):**
- Delete court

### Multi-select Bulk Mode
- Checkbox on each card when bulk mode is active
- Floating action bar: "Reset to Available" | "Delete" | "Cancel"
- Bulk "Reset to Available" skips `IN_USE` courts silently
- Bulk "Delete" blocks entirely if any selected court is `IN_USE`

### Components
- `AddMultipleCourtsDialog` — single number input with +/− stepper (min 1, max 20); confirm creates all courts in one transaction
- `CourtStatusBadge` — green=Available, blue=In Use
- `DeleteCourtConfirm` — "Court N will be removed. Match history is preserved. Delete anyway?"
- `BulkActionBar` — fixed bottom bar in multi-select mode

---

## Server Actions (`src/server/actions/courts.ts`)

```typescript
createCourt(): Promise<Court>
// auto-assigns number = max(existing numbers) + 1, starting at 1

createCourts(count: number): Promise<Court[]>
// creates `count` courts in a single transaction, numbered sequentially from max + 1

deleteCourt(id: string): Promise<void>
// blocked if court is IN_USE
// hard delete — Match.courtId nulled via onDelete: SetNull; Match.courtName snapshot preserved

resetAllToAvailable(): Promise<void>
// sets status=AVAILABLE on all IN_USE courts

bulkResetToAvailable(ids: string[]): Promise<void>
// skips IN_USE courts silently

bulkDelete(ids: string[]): Promise<void>
// blocked if any selected court is IN_USE

getCourts(): Promise<CourtWithActiveMatch[]>
// ordered by number ASC; includes active match player names if IN_USE
```

---

## Automatic Status Transitions
Handled inside match actions:
- `startMatch(matchId)` → sets `court.status = IN_USE`
- `endMatch(matchId)` → sets `court.status = AVAILABLE`
- `voidMatch(matchId)` → sets `court.status = AVAILABLE` if court was `IN_USE`

---

## Numbering Behavior
- First court added: Court 1
- Each subsequent court: `max(existing numbers) + 1`
- Deleting Court 3 from [1, 2, 3, 4] leaves [1, 2, 4] — no renumbering of existing courts
- Next court added after that: Court 5
- Gaps in numbering are intentional and acceptable

---

## Edge Cases
- **Delete court that is In Use**: blocked — "End the active match on Court N before deleting it"
- **Bulk delete with any In Use court selected**: block entire operation, list which courts are blocked
- **"Reset All to Available" with no In Use courts**: no-op; toast shows "All courts already available"
- **All courts deleted**: empty state with a single "Add Court" button
- **Court deleted mid-session**: `Match.courtName` snapshot ("Court 3") preserved in match history; queue and payments unaffected
