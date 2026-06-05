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
- Defaults for venue, currency, fee, rating, and queue rules.

## Component Composition

- Session setup form.
- Court setup section.
- Payment requirement setting.
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

- `POST /api/sessions`
- `POST /api/sessions/:sessionId/courts`

## Acceptance Criteria

- Required fields are validated near inputs.
- Defaults reduce typing for repeated badminton sessions.
- Created sessions are immediately discoverable in the session list.
- No login is required for MVP v1.
