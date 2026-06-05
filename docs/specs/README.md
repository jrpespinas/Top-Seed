# Spec Index

These specs are the source of truth for the badminton queueing MVP. Read `AGENTS.md` first, then use the most relevant spec below before designing or implementing a feature.

## MVP Scope

MVP v1 is a no-login, organizer-only badminton web app. The organizer manually manages players, check-ins, courts, queueing, payments, match results, leaderboard, and match history. The app must be local-first and offline-resilient for live session operation: actions save locally, show sync state, and sync when connectivity returns. Player self-service check-in, player status, player profile, and player-owned history are future-version features.

## Product And Architecture

- `docs/specs/architecture.md`: product boundary, system shape, core flow, roles, consistency rules.

## Backend Specs

- `docs/specs/backend/domain-model.md`: entities, states, relationships, and invariants.
- `docs/specs/backend/api-spec.md`: API resources, endpoint shape, authorization expectations, and error format.
- `docs/specs/backend/queueing-and-ratings.md`: match suggestion rules, deterministic scoring, organizer overrides, and rating updates.
- `docs/specs/backend/payments.md`: manual payment statuses, validation, queue interaction, and session summaries.

## Frontend Specs

- `docs/specs/frontend/component-architecture.md`: app areas, route structure, component layers, and state ownership.
- `docs/specs/frontend/organizer-components.md`: organizer dashboard components and responsibilities.
- `docs/specs/frontend/player-components.md`: future-version player check-in, status, history, and leaderboard components.
- `docs/specs/frontend/design-system.md`: reusable UI components, status labels, action hierarchy, responsive rules, and copy guidelines.
- `docs/specs/frontend/frontend-stack.md`: chosen frontend stack, component-system approach, libraries to avoid, local-first expectations, and testing implications.
- `docs/specs/frontend/frontend-technical-standards.md`: frontend implementation standards for units, tokens, typography, spacing, breakpoints, styling, accessibility, motion, and formatting.
- `docs/specs/frontend/components/`: reusable primitive and domain component specs.
- `docs/specs/frontend/features/`: organizer and player feature component specs.
- `docs/specs/frontend/pages/`: route-level page specs.

## Change Rule

When implementation needs diverge from a spec, update the relevant spec in the same change and explain the reason in the pull request or handoff notes.
