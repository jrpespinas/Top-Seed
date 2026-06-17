# MVP Access Spec

## Purpose

Define who can do what in MVP v1. This file is the source of truth for access behavior while the product has no login, no roles, and no player self-service.

Related specs:

- `docs/specs/backend/api-spec.md`
- `docs/specs/frontend/component-architecture.md`
- `docs/specs/backend/state-transitions.md`

## Core Rule

MVP v1 assumes **one organizer device** running a live session. Whoever opens the organizer app on that device is the queue master.

There is **no authentication**, **no role checks**, and **no permission-denied UI** in MVP v1.

## The Only Lock: Session Mode

Access is controlled by **session status**, not user role.

| Session status | Mode | Organizer can |
|----------------|------|----------------|
| `draft`, `open`, `active` | **Live** | Use all dashboard actions: check-in, queue, courts, payments, match results, session edit, complete/cancel |
| `completed`, `cancelled` | **Ended (read-only)** | View history, leaderboard, and payments only |

Live session actions include:

- Add/edit players and check-ins
- Queue lane and queued match management
- Court assignment, start, finish, and cancel
- Payment updates
- Match result recording and correction (when allowed by result rules)

Ended session restrictions:

- Hide or disable live operation actions on the dashboard and related pages.
- Do not allow new check-ins, queue changes, court assignments, or payment edits unless a future spec explicitly adds post-session correction.
- Keep audit/history, leaderboard, and payment summaries viewable.

Dangerous live actions still require **confirmation dialogs** (for example complete session, cancel session, cancel match, delete non-empty queue lane). Confirmation is UX safety, not role enforcement.

## What MVP Does Not Include

Do not implement in MVP v1:

- Login or sign-up screens
- Owner / organizer / player role badges or gates
- `Permission denied` empty states or hidden actions based on role
- `Current organizer permission level` in the session header or elsewhere
- **Share session** actions for player check-in links, QR codes, or guest status URLs
- Player self-check-in from shared links
- Guest or player-facing session entry

Future authenticated versions may add roles and share links. Keep optional props/hooks where cheap, but do not enforce them in MVP.

## Frontend Spec Wording

Replace older permission language in feature specs:

| Avoid in MVP specs | Use instead |
|--------------------|-------------|
| Requires organizer permission | Available in live session; hidden or disabled when session is ended |
| Only owner and organizer can… | Available while session is live |
| Permission denied | Remove this state from MVP |
| Current organizer permission level | Remove from required data |

`player-check-in-panel.md` is the reference pattern for MVP access notes.

## Session Header (MVP)

Required header data:

- Session name, venue, date/time, status, fee, court count
- Connection status, sync status, pending/failed action counts, last synced time

Do not require in MVP:

- Organizer permission level or role badge
- `onShareSession` action or Share button

Allowed header actions in live session:

- Edit session
- Complete session (with confirmation)
- Cancel session (with confirmation)
- Retry sync / review sync issues

## API Baseline (MVP)

- Treat organizer API endpoints as application endpoints without auth middleware in MVP v1.
- Document future role rules separately; do not block MVP endpoints behind login.
- Do not expose player-owned check-in, guest status links, or authenticated profile flows in v1.

## Component Implementation Note

Components may accept optional `canEdit` or `sessionMode` props derived from **session status** (`live` vs `ended`). Do not derive those props from user role in MVP.

## Test Scenarios

Access tests should cover:

- All live dashboard actions are available without login during an active session.
- Completed session hides live queue, court, and check-in actions.
- Cancelled session hides live queue, court, and check-in actions.
- No Share session control appears in MVP session header.
- Confirmation is still required for complete session, cancel session, and cancel match.
