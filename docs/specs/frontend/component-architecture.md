# Frontend Component Architecture Spec

## Frontend Goal

Build a responsive organizer-only web app that lets badminton organizers run sessions from tablets and phones. The organizer dashboard is the primary MVP surface. Player self-service screens are future-version work, not MVP v1.

MVP access rules: `docs/specs/mvp-access.md`. Match assignment pipeline: `docs/specs/backend/queueing-and-ratings.md` (Match Assignment Pipeline).

**Do not use deprecated aliases** such as `SuggestedMatchPanel`, `NextQueue`, `Magic Queue`, or `onAutoFillQueue`.

## MVP Access Summary

- No login, no roles, and no permission-denied UI in MVP v1.
- The only lock is session mode: `completed` and `cancelled` sessions are read-only.
- Accept suggestion stages in Next lanes; direct court assignment is a labeled override.

## Layout Priorities

Primary targets (co-primary for MVP live session):

- **Phone portrait** when the organizer has only a phone at the hall.
- **Tablet landscape** for the ideal pegboard view beside courts.
- **Desktop** for the same live workflows with more side-by-side context.

The live dashboard preserves a pegboard mental model: `Available` players, `Next` queued matches, and `Now` active courts. On phone, use tabs or a courts-first stack per `docs/specs/frontend/design-system.md`.

Secondary emphasis:

- Quick organizer actions on any device size.

## Dashboard Composition Model

The organizer dashboard should be court-first and pegboard-inspired.

Desktop composition:

- Left: `PlayerPool`, combining quick check-in, search, waiting/resting players, and payment badges.
- Center: `CourtBoard`, showing courts as spatial containers with Team A / Team B slots.
- Right: `NextQueuePanel`, showing one or more queue lanes, multiple lined-up matches, and accept/manual assignment actions.
- Bottom/supporting area: recent matches, payment exceptions, and leaderboard shortcut.

Tablet composition:

- Keep `CourtBoard` and `NextQueuePanel` visible together.
- Place `PlayerPool` below or beside them depending on available width.
- Keep recent matches and payment exceptions secondary.

Mobile composition:

- Use bottom tabs on phone when possible: **Now** (default) | **Next** | **Available** | **More**.
- Fallback single-column stack: sync → courts → next queue → check-in → player pool → payments → recent matches.
- Do not require drag-and-drop on mobile; provide assign, swap, and move buttons.

## App Areas

Organizer routes:

- `/`
- `/organizer/sessions`
- `/organizer/sessions/new`
- `/organizer/sessions/:sessionId/dashboard`
- `/organizer/sessions/:sessionId/players`
- `/organizer/sessions/:sessionId/payments`
- `/organizer/sessions/:sessionId/history`
- `/leaderboard` or `/organizer/leaderboard`

Future player routes:

- `/session/:sessionId/check-in`
- `/session/:sessionId/status`
- `/player/me`

## Component Layers

Use four component layers:

- `app`: route components, layouts, data loading boundaries.
- `features`: domain-specific components such as queue board, court board, payment panel.
- `components`: reusable UI components such as buttons, dialogs, cards, tabs.
- `lib`: formatting, client utilities, validation helpers, API clients.

Use the frontend stack defined in `docs/specs/frontend/frontend-stack.md`: React, TypeScript, Vite, TanStack Router, TanStack Query, Dexie, Tailwind CSS, Radix UI, optional dnd-kit, Zod, and PWA app-shell support.

Suggested structure:

```text
src/
  app/
  features/
    organizer/
    player/
    sessions/
    queue/
    matches/
    payments/
  components/
    ui/
    forms/
    layout/
  lib/
    api/
    dates/
    ratings/
    validation/
    local-db/
    sync/
```

Stack-aware organization:

- `components/ui`: custom styled primitives built from Tailwind tokens and Radix behavior primitives.
- `components/forms`: form field wrappers, validation messages, and Zod-integrated form helpers.
- `components/layout`: shells, panel grids, responsive dashboard layout primitives.
- `features/organizer`: badminton-specific composition such as court board, queue lane management, next queue, player pool, payments, and match history.
- `lib/local-db`: Dexie schema and local-first persistence helpers.
- `lib/sync`: outbox creation, retry logic, sync status derivation, and TanStack Query sync calls.
- `lib/validation`: Zod schemas for forms, local records, and sync payloads.

Do not treat `components/ui` as a direct mirror of a generic UI kit. Components should be project-owned, visually aligned to Top Seed tokens, and replaceable without changing domain features.

Detailed specs live in:

- `docs/specs/frontend/components/`: reusable primitive and domain component contracts.
- `docs/specs/frontend/features/`: organizer and player feature component contracts.
- `docs/specs/frontend/pages/`: route-level page contracts.

When implementing a page, read the page spec first, then the referenced feature and component specs. When implementing a reusable component, read only the relevant component spec plus `design-system.md` and `frontend-technical-standards.md`.

## Data Handling

Component responsibilities:

- Route components fetch initial data and coordinate access boundaries. MVP v1 has no login, but routes should stay easy to protect later.
- Route and data hooks should consume API envelopes, cursor pagination, and dashboard snapshot contracts from `docs/specs/backend/api-contracts.md`.
- Route components initialize local session state, connection status, and sync outbox state.
- Feature components receive domain-shaped data and emit actions.
- UI components remain domain-agnostic.
- Mutation hooks write to local state first, enqueue sync actions, and own loading, pending, synced, and error recovery states.

Do not let low-level UI components call session APIs directly.

## State Categories

Server state:

- Sessions, courts, queue lanes, queued matches, check-ins, matches, payments, ratings, leaderboard.

Local-first state:

- Local session snapshot.
- Local player/court/queue-lane/queued-match/check-in/match/payment records.
- Sync outbox actions.
- Connection status.
- Last successful sync timestamp.
- Failed sync actions and recoverable errors.

Client UI state:

- Selected court.
- Open modal.
- Filter tabs.
- Selected queue lane.
- Pending form input.
- Suggested match preview.

Derived state:

- Waiting count.
- Payment totals.
- Court occupancy.
- Player status labels.
- Sync status labels.
- Cached leaderboard and match history.

Keep derived state close to the component that renders it unless multiple features need it.

## Offline Responsibilities

- Critical organizer workflows must read and write local state even when offline.
- Online sync should reconcile queued actions in the background.
- The UI must show whether data is `Offline`, `Saved on this device`, `Syncing`, `Synced`, or `Sync failed`.
- In-progress forms must not be cleared by reconnect, polling, or sync acknowledgement.
- Failed sync actions must remain retryable and visible enough for the organizer to recover.

## Interaction Standards

- Every organizer mutation should show immediate feedback.
- Dangerous actions such as cancelling a match or completing a session require confirmation.
- Common actions such as mark paid, start match, finish match, and add suggestion to Next queue should be one tap from the dashboard.
- Empty states should explain the next action.
- Error states should preserve entered data.

## Accessibility

- All controls must be keyboard reachable.
- Buttons must have descriptive labels.
- Status must not rely only on color.
- Dialogs must trap focus.
- Tables or lists should remain readable on small screens.

## Testing Expectations

Frontend tests should cover:

- Dashboard renders court, queue, payment, and suggestion states.
- Organizer can accept a suggested match into a Next lane.
- Organizer can promote a ready queued match to court or use labeled direct court assignment.
- Payment status updates reflect in summaries.
- Organizer-managed player add/check-in handles returning and new players.
- Responsive behavior for key dashboard sections.
