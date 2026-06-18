# Page Specs

Page specs define route-level behavior: who uses the page, how users arrive, which data loads, which feature components compose the screen, and what happens in loading, empty, error, and permission states.

Read first:

- `docs/specs/frontend/component-architecture.md`
- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- Relevant feature specs in `docs/specs/frontend/features/`
- Relevant backend API specs in `docs/specs/backend/`

## Page Responsibility

Pages should:

- Coordinate route-level access rules. MVP v1 has no login, but pages should be structured so auth can be added later.
- Load page data.
- Initialize or read local-first page data where the route supports offline operation.
- Compose feature components.
- Own navigation after major actions.
- Coordinate route-level loading, empty, error, and permission-denied states.
- Show connection, pending sync, and sync failure state when local changes may exist.
- Keep workflows aligned with backend API contracts.

Pages should not:

- Re-define reusable component variants.
- Hide important loading or error states inside low-level components.
- Fetch data directly inside primitive UI components.
- Add workflows outside the MVP route scope without updating specs.

## MVP Route Defaults

- Root organizer entry: `/organizer/sessions` or the most recent active session.
- Live operating center: `/organizer/sessions/:sessionId/dashboard` (immersive workspace — no global app header).
- Organizer-accessible payments: `/organizer/sessions/:sessionId/payments` (via `SessionWorkspaceShell`).
- Organizer-accessible match history: `/organizer/sessions/:sessionId/history` (via `SessionWorkspaceShell`).
- `/organizer/sessions/:sessionId/players` redirects to dashboard in MVP v1; check-in lives on the dashboard.
- Organizer-accessible leaderboard: `/leaderboard` or `/organizer/leaderboard` (session scope via `?sessionId=` from workspace overflow).
- Public marketing homepage: deferred unless explicitly requested.

Session workspace chrome: `features/organizer/session-header.md`, `features/organizer/session-workspace-shell.md`.

## Future Player Routes

- Player QR/shared link entry: `/session/:sessionId/check-in`.
- Player post-check-in status: `/session/:sessionId/status`.
- Player profile and owned history: `/player/me`.
