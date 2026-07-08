# Spec: Sessions (ground truth — what's actually built)

## Scope
A real `Session` lifecycle replaces the old always-on mock session. There is at most one **open** session at a time (`CurrentSession`, a thin pointer: id + start date). Starting one gives a clean slate — empty courts, queue, bench, and 3 blank matchup cards. Closing one freezes a snapshot (who played, what they paid, match/court counts) into a permanent `SessionRecord` and clears the board.

**There is currently no backend** — everything here is `localStorage`-backed, in `src/lib/session-store.ts`, following the same read/write/listener pattern as the rest of the app's stores.

This is a deliberately **narrower** implementation than `docs/specs/06-payment-tracking.md`'s target vision (that file describes session fee amounts, reopening closed sessions, blocking a second "New Session" while one is open, and a separate `/sessions/[id]/payments` route). None of that exists yet — see "Gaps vs. the target spec" below.

---

## Data Model (current, from `src/types/index.ts`)

```typescript
interface CurrentSession {
  id: string;
  date: string; // ISO, when started
}

interface SessionPlayerSnapshot {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  paymentStatus: PaymentStatus;
}

interface SessionRecord {
  id: string;
  date: string;       // ISO, when started
  closedAt: string;    // ISO, when closed
  players: SessionPlayerSnapshot[]; // frozen at close time — not a live roster
  matchCount: number;  // COMPLETED matches with this sessionId, at close time
  courtCount: number;  // courts.length at close time
}
```

`MatchRecord` gained a required `sessionId`, stamped at creation from the current open session. Matches recorded before this field existed have none — they simply don't count toward any session's `matchCount`. The Matches page itself is **not** session-filtered yet (see Gaps below); it still shows every match ever recorded, same as before.

---

## Lifecycle (`src/lib/session-store.ts`)

- **`startSession()`**: generates a new `CurrentSession`, writes empty arrays to the queue/bench/courts keys and 3 blank `PlanningCard`s to the planning-cards key, notifies all listeners.
- **`closeSession(matches)`**: reads the live queue+bench (deduplicated by player id) into `SessionPlayerSnapshot[]`, counts this session's `COMPLETED` matches from the `matches` array the caller passes in (from its own `useMatchLog()` — this file never imports `match-log-store` directly, keeping the two stores decoupled), reads `courts.length`, prepends the resulting `SessionRecord` to the archive, then clears the current-session pointer and all four live keys. Returns the record.
- **`useCurrentSession()`** / **`useSessionArchive()`**: read-only hooks for the page shell and the `/sessions` pages.
- **`clearSessionArchive()`**: wipes only the closed-session archive (`top-seed:sessions`). Deliberately narrower than a full reset — the currently open session, if any, keeps running untouched. Exposed on `/settings` as "Clear session history," alongside the broader "Reset all data" (which clears every `top-seed:*` key and does a full reload).
- **Courts and Planning Cards are now persisted** (`useSessionCourts`/`useSessionPlanningCards`, mirroring the existing `useSessionQueue`/`useSessionBench` owner-hook pattern, plus a `useCourtsSnapshot()` read-only counterpart). Previously these were plain React state in `DashboardClient` that silently reset to mock data on every reload — a real bug this feature's prerequisite fix closed.

## Pages & Components

### `/` — Dashboard (`src/app/page.tsx`, now a client component)
Calls `useCurrentSession()`. If null, renders `NoSessionState` — "No active session" / "Start Session" button wired to `startSession()`. If present, renders `SessionHeader` (live player/court counts via snapshot hooks) + `<DashboardClient sessionId={session.id} />`, keyed on the session id so a session boundary always gets a clean component remount.

### `SessionHeader.tsx`
Gained a required `onClose` prop. The existing (previously decorative) "Close session?" confirm button now calls it — `page.tsx` wires this to `closeSession(matches)`.

### `/sessions` — Session List (`SessionsListView.tsx`)
A plain table, no filters (session count is expected to stay small). The current open session (if any) is pinned at the top with a live-computed row (recomputed from snapshot hooks, not frozen); closed sessions below it, newest first, from the archive. Columns: date (links to detail), status badge, player count, match count, court count, a compact payment summary ("12 paid · 2 unpaid · 1 waived", omitting "waived" when zero). Empty state: "No sessions yet — start your first session from the Dashboard."

### `/sessions/[id]` — Session Detail (`SessionDetailView.tsx`)
Single page, not split into a `/payments` sub-route. Resolves `id` against `useCurrentSession()` first (live view if it matches the open session) then `useSessionArchive()` (frozen view otherwise); shows "Session not found" if neither matches. Header: date, status badge, a dense meta line (players · matches · courts · paid · unpaid · waived, matching `SessionHeader`'s own compact style). Below: a read-only player table (name, skill badge, gender icon, payment `StatusBadge`) — no editing here; payment/roster edits still happen on `/players` for the open session only, since closed sessions are frozen by definition.

---

## Known Gaps vs. `06-payment-tracking.md`'s target

- **No fee amounts.** Payment is still just Paid/Unpaid/Waived (see `01-player-management.md`) — no `session.defaultFee`, no per-payment override, no dollar totals anywhere.
- **No reopening a closed session.** Closing is one-directional; there's no "Reopen" action anywhere in the UI.
- **No guard against starting a session while one's already open** — moot in practice today, since `NoSessionState` (the only UI path to `startSession()`) is itself gated on there being no current session, but there's no explicit "a session is already open" error path if that ever changed.
- **Closing a session with matches still in progress silently drops them.** `closeSession()` clears courts unconditionally — any `activeMatch` in progress at close time is discarded, not voided or recorded. No confirmation warns the organizer about this today.
- **In-match players are still invisible on `/players` and in session snapshots/counts.** This one is now *fixable* rather than a hard architectural gap — courts are a real persisted, cross-page-readable store as of this feature (`useCourtsSnapshot()`), unlike before. Actually wiring in-match players into the Players page and session snapshots (with their own visual state, e.g. "Playing") is a natural next step, not done here.
- **`/matches` and `/leaderboard` are not session-filtered.** Both still show all-time data across every session ever played, even though `MatchRecord.sessionId` now exists to support scoping them. Retrofitting those two pages is separate follow-on work.
