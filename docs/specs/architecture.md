# Architecture Spec

## System Purpose

Top Seed is a mobile and tablet responsive web app for running badminton open-play sessions. The MVP is organizer-centric: the queue master should be able to run check-ins, courts, queue assignments, match results, player records, and manual payment tracking from one live dashboard.

## MVP Boundaries

In scope:

- Badminton open-play sessions, primarily doubles.
- Organizer-managed sessions, courts, players, queue, matches, results, ratings, and manual payments.
- Organizer-managed player check-in, player records, leaderboard, and match history.
- Lightweight internal ratings for fair match suggestions.
- Local-first offline resilience for live session operation on one organizer device.

Out of scope:

- Login, account management, and role-based access.
- Player self-service check-in, current status, upcoming match, and player-owned profile pages.
- Online payment processing.
- Tournament brackets and full league scheduling.
- Native mobile applications.
- Court booking integrations.
- Multi-sport configuration abstractions.
- Public Elo claims or official ranking systems.

## Recommended Application Shape

Use a local-first responsive web architecture with a browser local store, sync outbox, backend API, relational database, and simple connectivity recovery path.

The backend should be a Clean Architecture inspired modular monolith for MVP v1: one deployable application with explicit domain, application use case, interface, and infrastructure boundaries. See `docs/specs/backend/backend-architecture.md` for implementation rules.

```mermaid
flowchart TD
    OrganizerWeb[Organizer Web] --> LocalStore[Browser Local Store]
    LocalStore --> Outbox[Sync Outbox]
    Outbox --> Api[Backend API]
    Api --> UseCases[Application Use Cases]
    Api --> SyncProcessor[Sync Action Processor]
    SyncProcessor --> UseCases
    UseCases --> Domain[Domain Layer]
    Domain --> QueueService[Queue Policy]
    Domain --> RatingService[Rating Policy]
    Domain --> PaymentService[Payment Rules]
    Domain --> SessionRules[Session Invariants]
    UseCases --> Database[(PostgreSQL)]
```

## Application Areas

- Organizer app: session setup, live dashboard, court board, queue, payments, match results, player management.
- Organizer reporting: leaderboard and match history.
- Local-first runtime: browser local store, pending action outbox, connection/sync status, and future exportable backup (export deferred in MVP v1).
- Backend API: organizations/workspace, sessions, check-ins, courts, queue lanes, queued matches, matches, payments, queue suggestions, ratings, leaderboard.
- Backend application use cases: organizer workflows and sync-replayable mutations such as check-in, queue lane changes, match assignment, payment updates, and result recording.
- Backend domain rules: queue generation, rating updates, payment state transitions, session consistency checks, and sync validation.

## Core Domain Flow

```mermaid
flowchart TD
    CreateSession[Create Session] --> ConfigureCourts[Configure Courts]
    ConfigureCourts --> CheckInPlayers[Check In Players]
    CheckInPlayers --> QueueDashboard[Queue Dashboard]
    QueueDashboard --> GenerateSuggestion[Generate Match Suggestion]
    GenerateSuggestion --> OrganizerDecision[Organizer Accepts Or Edits]
    OrganizerDecision --> AssignCourt[Assign Court]
    AssignCourt --> MatchInProgress[Match In Progress]
    MatchInProgress --> RecordResult[Record Result]
    RecordResult --> UpdatePaymentAndRating[Update Rating And History]
    UpdatePaymentAndRating --> ReturnToWaiting[Return Players To Waiting]
    ReturnToWaiting --> QueueDashboard
```

## Data Consistency Rules

Player, queued match, court match, court, and session state transitions are defined in `docs/specs/backend/state-transitions.md`.

- A player can have only one active `checkIn` per active `session`.
- A court can have at most one active match.
- A checked-in player can be in only one of these live states: `waiting`, `assigned`, `playing`, `resting`, `done`, or `removed`.
- A player may be staged in multiple queued matches across lanes, but cannot be on two active court matches in the same session.
- A match result should update match history and rating history atomically.
- Payment status belongs to a session-level check-in, not the global player profile.
- Direct API mutations and offline sync replay should call the same backend application use cases.

## Offline And Sync Strategy

MVP v1 must keep a live session usable during temporary disconnection. The browser local store is the source of truth while the organizer is offline or while actions are pending sync. The backend becomes authoritative after queued actions sync successfully.

Required offline-capable operations:

- View the active session dashboard.
- Add and edit players.
- Check players in and update queue status.
- Add, delete, pause, reopen, and mark courts unavailable.
- Add, rename, reorder, and delete queue lanes.
- Create, edit, remove, and promote queued matches.
- Assign courts and manage active matches.
- Generate match suggestions from cached local session state.
- Start and finish matches.
- Record scores and results.
- Track manual payments.
- View cached leaderboard and match history.
- Queue local actions for later sync.

Sync model:

```mermaid
flowchart TD
    UserAction[Organizer Action] --> LocalStore[Local Store]
    LocalStore --> UpdateUI[Update UI Immediately]
    LocalStore --> Outbox[Sync Outbox]
    Outbox --> OnlineCheck{Online}
    OnlineCheck -->|No| Pending[Show Pending Sync]
    OnlineCheck -->|Yes| ApiSync[Send Batch To API]
    ApiSync --> Server[Backend Persists]
    Server --> Ack[Sync Acknowledgement]
    Ack --> LocalStore
    ApiSync -->|Conflict Or Error| SyncError[Show Recoverable Error]
```

MVP limitations:

- Best for one organizer device per live session.
- Cross-device sync and concurrent organizers are not required.
- Cloud backup only happens after connectivity returns.
- Clearing browser data can remove unsynced local changes unless a future backup export has been saved (export not in MVP v1).
- The app should warn before destructive browser-storage actions when possible.

## Realtime Strategy

Start with local-first state updates and background sync. Server polling or server-sent events can refresh server snapshots when online. Move to WebSockets only when concurrent organizer editing or public live boards become necessary.

The organizer dashboard should refresh these data sets together:

- Active courts and matches.
- Waiting and resting players.
- Suggested next matches.
- Payment status counts.
- Recently completed matches.

## MVP Access Model

MVP v1 has no login component. Treat the app as a single organizer-operated workspace. The organizer manually manages players, sessions, courts, payments, match results, leaderboard, and match history.

Implementation may still keep internal fields that can later connect to authenticated users, but v1 screens should not require sign-in, player accounts, or guest access links. MVP access rules: `docs/specs/mvp-access.md`.

## Future Direction

Future versions may add:

- Organizer login and organization membership.
- Player accounts.
- Player self-service check-in through QR or shared links.
- Player current status and upcoming match views.
- Player-owned match history and profile pages.
- Public or player-facing leaderboard access.

When adding these, update auth, route, API, and permission specs in the same change.

## Quality Bar

- Queueing behavior must be testable and deterministic.
- Payment transitions must be auditable.
- Organizer overrides must be recorded as ordinary match assignments.
- The app should remain usable on a tablet beside the courts with high visual clarity and low typing.
