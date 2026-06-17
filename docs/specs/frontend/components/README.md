# Component Specs

Use these specs when implementing reusable UI building blocks. Component specs define behavior, states, accessibility, variants, and testing expectations. They should not define route-level data loading or page composition.

Read first:

- `docs/specs/frontend/design-system.md`
- `docs/specs/frontend/frontend-technical-standards.md`
- `docs/specs/frontend/component-architecture.md`

## Folder Model

- `primitives/`: reusable app-wide UI components with no badminton-specific domain logic.
- `domain/`: reusable components that display badminton, payment, queue, court, player, or match concepts.

## Usage Rule

If an agent is asked to implement a component, read that component spec plus the design and technical standards. If the component is used inside a route, also read the relevant feature or page spec.

## Component Boundary

Reusable components should:

- Accept data and callbacks through props.
- Avoid direct API calls.
- Avoid owning route-level state.
- Expose accessible labels and states.
- Use tokens from `frontend-technical-standards.md`.

Reusable components should not:

- Decide which page they appear on.
- Fetch session data directly.
- Encode role-based permissions in MVP. Pass optional `sessionMode` (`live` vs `ended`) when an action should be disabled for completed/cancelled sessions. See `docs/specs/mvp-access.md`.
- Invent one-off colors, spacing, labels, or loading patterns.
