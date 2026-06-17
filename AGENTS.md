# Agent Guidance

## Product North Star

Build an organizer-centric badminton queueing web app for open-play sessions. The MVP must help a queue master run a real session: check players in, manage courts, track manual payments, assign fair doubles matches, record results, and keep the queue moving from a mobile or tablet web interface, even through temporary disconnection.

MVP v1 has no login and no player self-service. The organizer manually adds and checks in players, manages courts and queueing, records results, tracks manual payments, and views leaderboard and match history. MVP v1 is local-first: live session operations must write locally first, continue offline, and sync when connectivity returns. Player-facing check-in, upcoming match, player profile, and player-owned history are future-version features. Do not expand into player accounts, tournament brackets, online payments, native apps, venue booking, or multi-sport abstractions until the organizer-only badminton MVP is stable.

## Canonical Specs

Read these files before making feature or architecture decisions:

- `docs/specs/README.md`
- `docs/specs/architecture.md`
- `docs/specs/mvp-access.md`
- `docs/specs/backend/backend-architecture.md`
- `docs/specs/backend/backend-stack.md`
- `docs/specs/backend/sync-actions.md`
- `docs/specs/backend/sync-payload-reference.md`
- `docs/specs/backend/api-contracts.md`
- `docs/specs/backend/domain-model.md`
- `docs/specs/backend/state-transitions.md`
- `docs/specs/backend/api-spec.md`
- `docs/specs/backend/queueing-and-ratings.md`
- `docs/specs/backend/match-results-and-ratings.md`
- `docs/specs/backend/payments.md`
- `docs/specs/frontend/component-architecture.md`
- `docs/specs/frontend/organizer-components.md`
- `docs/specs/frontend/player-components.md`
- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-stack.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/components/`
- `docs/specs/frontend/features/`
- `docs/specs/frontend/features/organizer/player-detail-drawer.md`
- `docs/specs/frontend/features/organizer/sync-review-panel.md`
- `docs/specs/frontend/pages/`

If implementation needs conflict with these specs, update the relevant spec in the same change and explain why.

## Engineering Standards

- Prefer boring, explicit code over clever abstractions.
- Use the backend Clean Architecture modular monolith from `docs/specs/backend/backend-architecture.md` with **Fastify**, **Prisma**, and **PostgreSQL** per `docs/specs/backend/backend-stack.md`: domain rules in `packages/domain` stay framework-free, Fastify routes stay thin, and sync replay shares application use cases with direct API mutations.
- Use `docs/specs/backend/sync-actions.md` as the source of truth for offline sync action names, semantics, idempotency, ordering, and per-action results.
- Use `docs/specs/backend/sync-payload-reference.md` for golden JSON payload examples and shared input shapes (`SyncParticipantInput`, `MatchResultInput`).
- Use `docs/specs/backend/api-contracts.md` for `/api/v1` versioning, response envelopes, cursor pagination, DTO shape, dashboard snapshot, and API security baseline.
- Keep domain language consistent: `organization`, `session`, `court`, `queue lane`, `queued match`, `player`, `check-in`, `match`, `team`, `payment`, `rating`.
- Design for badminton doubles first. Singles and other racket sports can be added later behind explicit product decisions.
- Keep queueing logic deterministic and explainable to organizers.
- Use `docs/specs/backend/match-results-and-ratings.md` for winner, draw, unscored, cancelled, correction, rating mode, and leaderboard behavior.
- Use `docs/specs/backend/state-transitions.md` for player, queued match, court match, court, and session state transitions during live session operation.
- Use `docs/specs/mvp-access.md` for MVP v1 no-login access rules and session-mode read-only behavior.
- Use `docs/specs/frontend/organizer-components.md` for canonical dashboard component names, composition tree, and deprecated aliases.
- Preserve organizer override paths. Suggestions should assist the queue master, not remove control. Default assignment stages in Next lanes; direct court assignment is a labeled override per `docs/specs/backend/queueing-and-ratings.md`.
- Treat payments as manual tracking in MVP. Do not add payment gateway concepts unless requested.
- Optimize the live organizer dashboard for phone, tablet, and desktop per `docs/specs/frontend/design-system.md`.
- Do not require constant connectivity for live session operations. Use local-first state and sync recovery for MVP workflows.
- Add tests around queueing, ratings, permissions, and payment state transitions when code is implemented.

## Feature Discipline

Do not add features unless they directly support one of these MVP outcomes:

- Faster organizer-managed player check-in.
- Clearer court and queue visibility.
- Fairer match suggestions.
- Easier result recording.
- Reliable manual payment tracking.
- Organizer-visible match history and leaderboard.
- Offline-resilient live session operation with clear sync status.

When uncertain, choose the smallest reversible implementation that keeps a real badminton session running smoothly.
