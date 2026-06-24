# Feature Component Specs

Feature specs describe badminton-specific UI sections that compose reusable components and emit workflow actions. They sit between reusable components and page specs.

Read first:

- `docs/specs/frontend/component-architecture.md`
- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- Relevant reusable component specs in `docs/specs/frontend/components/`

MVP organizer queue and detail behavior is specified in:

- `docs/specs/frontend/organizer-components.md` — **canonical component registry** (names, aliases, composition tree)
- `docs/specs/frontend/features/organizer/live-dashboard-layout.md` — **desktop pegboard layout**, zones, empty states, validation checklist
- `docs/specs/frontend/features/organizer/session-header.md` — **`SessionWorkspaceBar`** immersive session chrome
- `docs/specs/frontend/features/organizer/session-workspace-shell.md` — shared shell for payments / history
- `docs/specs/frontend/features/organizer/desktop-drag-and-drop.md` — optional desktop pegboard DnD (`dnd-kit`)
- `docs/specs/frontend/features/organizer/attention-rail.md` — exception strip (sync, unpaid)
- `docs/specs/frontend/features/organizer/next-queue-panel.md`
- `docs/specs/frontend/features/organizer/queue-lane-management.md`
- `docs/specs/frontend/features/organizer/player-pool.md`
- `docs/specs/frontend/features/organizer/player-detail-drawer.md`
- `docs/specs/frontend/features/organizer/sync-review-panel.md`

## Feature Responsibilities

Feature components should:

- Receive domain-shaped data from a route or data hook.
- Compose reusable components.
- Emit clear actions such as `onCheckInPlayer`, `onAcceptSuggestion`, or `onMarkPaid`.
- Own section-level UI state such as selected tab, open drawer, or local filter.
- Render loading, empty, error, and realtime update states.

Feature components should not:

- Own route navigation decisions.
- Duplicate backend validation rules.
- Fetch unrelated page data.
- Define reusable primitive styles.

## Feature Spec Format

Each feature spec should define:

- User job.
- Data required.
- Child components.
- Actions emitted.
- Permissions.
- Loading, empty, error, and realtime behavior.
- Responsive composition.
- Acceptance criteria.
