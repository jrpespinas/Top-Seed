# Organizer New Session Page

## Route

- `/organizer/sessions/new`

## Primary User

- Organizer.

## User Goal

Create a badminton open-play session with courts, fee, and queue settings.

## Entry Points

- `Create session` from `/organizer/sessions`.

## Data Dependencies

- Default organizer workspace.
- Defaults for venue, currency, fee, rating mode, and queue rules.

## Component Composition

- Session setup form.
- Court setup section.
- Session fee and currency (for payment tracking only).
- Queue mode: **Suggested matches** (default on) maps to `queueMode: suggested`; **Manual queue only** maps to `manual`.
- Rating mode setting: `Casual` or `Rated`.
- `FormField`, `Select`, `Button`, and `ConfirmAction` where needed.

## Page States

- Loading defaults.
- Form ready.
- Validation error.
- Creating session.

## Primary Actions

- Create draft session.
- Create and open session if supported.

## Secondary Actions

- Cancel and return to sessions.

## Responsive Layout

- Mobile: single-column form with sticky submit action.
- Tablet and desktop: grouped form sections.

## Navigation

- Successful creation goes to `/organizer/sessions/:sessionId/dashboard` or session detail based on created status.
- Cancel returns to `/organizer/sessions`.

## API Endpoints

- `POST /api/v1/sessions`
- `POST /api/v1/sessions/:sessionId/courts`

## Acceptance Criteria

- Required fields are validated near inputs.
- Defaults reduce typing for repeated badminton sessions.
- Rating mode defaults to `Casual`.
- Queue mode defaults to **Suggested matches** (`suggested`).
- **Manual queue only** hides the suggestion strip on the dashboard; lanes and manual staging still work.
- `Rated` mode explains that wins and draws can change player ratings; unscored and cancelled matches do not.
- Created sessions are immediately discoverable in the session list.
- No login is required for MVP v1.
