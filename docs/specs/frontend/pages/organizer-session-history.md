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
- Completed, draw, unscored, and cancelled matches.
- Match participants.
- Rating impact history if available.
- Local unsynced match completions or corrections.

## Component Composition

Wrapped in `SessionWorkspaceShell` with `activeView="history"`. Spec: `features/organizer/session-workspace-shell.md`.

- `SessionWorkspaceBar` (via shell)
- Filter buttons (All / Wins-Losses / Draws / Unscored / Cancelled)
- `MatchHistoryList` with `MatchCard` rows
- `Drawer` — match detail
- `MatchCorrectionDrawer`
- `SyncReviewPanel` (via shell)

Do **not** compose `SessionHistoryHeader`, `SessionSyncBar`, `RecentMatchesPanel`, or standalone `OfflineBanner` on this page.

## Page States

- Loading history.
- No matches completed.
- History ready.
- Correction form.
- Correction error.
- Offline cached history.
- Pending match history sync.
- Failed correction sync.
- Rated-session correction with rating recompute warning.

## Primary Actions

- View match detail.
- Correct result when allowed.

## Secondary Actions

- Filter completed, draw, cancelled, or unscored matches.
- Return to dashboard via workspace bar overflow (**Live dashboard**).

## Responsive Layout

- Mobile: compact match list.
- Tablet and desktop: list with detail drawer.

## Navigation

- Return to `/organizer/sessions/:sessionId/dashboard`.

## API Endpoints

- `GET /api/v1/sessions/:sessionId/matches`
- `PATCH /api/v1/sessions/:sessionId/matches/:matchId/result`
- `POST /api/v1/sync/actions`

## Acceptance Criteria

- Cancelled matches are visually distinct.
- Draw and unscored matches are distinct from winner/loser results.
- Result correction is organizer-only.
- Rated-session result correction explains that affected players are recomputed from the corrected match forward.
- Casual-session result correction explains that stats/history change without rating changes.
- Player-owned match history is future-version behavior.
- Locally completed and corrected matches remain visible while pending sync.
