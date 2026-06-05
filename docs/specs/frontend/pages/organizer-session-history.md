# Organizer Session History Page

## Route

- `/organizer/sessions/:sessionId/history`

## Primary User

- Organizer.

## User Goal

Review completed and cancelled matches for a session and correct results when allowed.

Match history should show locally completed matches immediately, even before backend sync.

## Entry Points

- Dashboard recent matches panel.
- Session navigation.

## Data Dependencies

- Session detail.
- Completed and cancelled matches.
- Match participants.
- Rating impact history if available.
- Local unsynced match completions or corrections.

## Component Composition

- `RecentMatchesPanel`
- `MatchCard`
- `Tabs`
- `Drawer`
- `ConfirmAction`
- `OfflineBanner`
- `SyncStatusBadge`

## Page States

- Loading history.
- No matches completed.
- History ready.
- Correction form.
- Correction error.
- Offline cached history.
- Pending match history sync.
- Failed correction sync.

## Primary Actions

- View match detail.
- Correct result when allowed.

## Secondary Actions

- Filter completed, cancelled, or unscored matches.
- Return to dashboard.

## Responsive Layout

- Mobile: compact match list.
- Tablet and desktop: list with detail drawer.

## Navigation

- Return to `/organizer/sessions/:sessionId/dashboard`.

## API Endpoints

- `GET /api/sessions/:sessionId/matches`
- `PATCH /api/sessions/:sessionId/matches/:matchId/result`
- `POST /api/sync/actions`

## Acceptance Criteria

- Cancelled matches are visually distinct.
- Result correction is organizer-only.
- Rating recalculation requirement is surfaced when implemented.
- Player-owned match history is future-version behavior.
- Locally completed and corrected matches remain visible while pending sync.
