# Spec Index

These specs are the source of truth for the badminton queueing MVP. Read `AGENTS.md` first, then use the most relevant spec below before designing or implementing a feature.

## MVP Scope

MVP v1 is a no-login, organizer-only badminton web app. The organizer manually manages players, check-ins, courts, queueing, payments, match results, leaderboard, and match history. The app must be local-first and offline-resilient for live session operation: actions save locally, show sync state, and sync when connectivity returns. Player self-service check-in, player status, player profile, and player-owned history are future-version features.

## Product And Architecture

- `docs/specs/mvp-access.md`: MVP v1 access rules, session-mode lock, and no-login behavior.
- `docs/specs/architecture.md`: product boundary, system shape, core flow, roles, consistency rules.

## Backend Specs

- `docs/specs/backend/backend-architecture.md`: Clean Architecture modular monolith structure, layering, sync replay, transactions, and testing rules.
- `docs/specs/backend/sync-actions.md`: canonical offline sync action catalog, semantics, ordering, idempotency, and response rules.
- `docs/specs/backend/sync-payload-reference.md`: golden JSON payload examples and shared sync input shapes.
- `docs/specs/backend/api-contracts.md`: API versioning, response envelopes, pagination, DTO shape, security baseline, and dashboard snapshot contract.
- `docs/specs/backend/domain-model.md`: entities, states, relationships, and invariants.
- `docs/specs/backend/state-transitions.md`: player, queued match, court match, court, and session state transition tables and pegboard rules.
- `docs/specs/backend/api-spec.md`: API resources, endpoint shape, authorization expectations, and error format.
- `docs/specs/backend/queueing-and-ratings.md`: match suggestion rules, deterministic scoring, organizer overrides, and rating updates.
- `docs/specs/backend/match-results-and-ratings.md`: match outcomes, rating mode, draw/unscored/cancelled behavior, leaderboard effects, and correction rules.
- `docs/specs/backend/payments.md`: manual payment statuses, validation, queue interaction, and session summaries.

## Frontend Specs

- `docs/specs/frontend/component-architecture.md`: app areas, route structure, component layers, and state ownership.
- `docs/specs/frontend/organizer-components.md`: organizer dashboard **canonical component registry**, composition tree, and responsibilities.
- `docs/specs/frontend/player-components.md`: future-version player check-in, status, history, and leaderboard components.
- `docs/specs/frontend/design-system.md`: reusable UI components, status labels, action hierarchy, responsive rules, and copy guidelines.
- `docs/specs/frontend/frontend-stack.md`: chosen frontend stack, component-system approach, libraries to avoid, local-first expectations, and testing implications.
- `docs/specs/frontend/frontend-technical-standards.md`: frontend implementation standards for units, tokens, typography, spacing, breakpoints, styling, accessibility, motion, and formatting.
- `docs/specs/frontend/components/`: reusable primitive and domain component specs.
- `docs/specs/frontend/features/`: organizer and player feature component specs.
- `docs/specs/frontend/features/organizer/next-queue-panel.md`: pegboard Next zone, suggestions, accept-to-lane staging, and queue lanes.
- `docs/specs/frontend/features/organizer/queue-lane-management.md`: lane CRUD and move-to-court (composed inside `NextQueuePanel`).
- `docs/specs/frontend/features/organizer/player-pool.md`: Available zone layout composite.
- `docs/specs/frontend/features/organizer/player-detail-drawer.md`: session + profile drawer.
- `docs/specs/frontend/features/organizer/sync-review-panel.md`: failed/pending sync recovery drawer.
- `docs/specs/frontend/pages/`: route-level page specs.

## Change Rule

When implementation needs diverge from a spec, update the relevant spec in the same change and explain the reason in the pull request or handoff notes.
