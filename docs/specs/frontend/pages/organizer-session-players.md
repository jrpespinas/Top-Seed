# Organizer Session Players Page

## Route

- `/organizer/sessions/:sessionId/players`

## Primary User

- Organizer.

## User Goal

Manually add, check in, and manage players for the session — without scattered inline forms on the list.

Player management must remain usable offline for the active session.

## Edit Surface Rule

`PlayerDetailDrawer` is the **primary and only full edit surface** for player profile and session fields on this page.

| Field group | Fields | Where to edit |
|-------------|--------|---------------|
| **Profile** | `displayName`, `phone`, `gender`, club rating (`defaultSkillRating`), organizer `notes` | `PlayerDetailDrawer` only |
| **Session** | Session skill rating, payment, queue status | `PlayerDetailDrawer` (queue quick actions may use row overflow menu) |
| **At check-in only** | Initial session rating, initial payment status | `PlayerCheckInPanel` when checking in or creating a walk-in |

Do **not** put inline profile editors (gender, name, phone, club rating, notes) on `PlayerRow` list items. Do **not** duplicate drawer forms in the page body.

Spec: `docs/specs/frontend/features/organizer/player-detail-drawer.md`.

## Page Layout

Top to bottom:

1. **`PlayerCheckInPanel`** — search returning players, create walk-in, check in with optional initial session rating and payment.
2. **`QueuePanel`** — tabs for waiting / resting / done / removed; search within list.
3. **`PlayerDetailDrawer`** — overlay opened from a row; not a permanent page column.

## Entry Points

- Dashboard player management link.
- `QueuePanel` on dashboard → same drawer pattern; this page is the dedicated management view.

## Data Dependencies

- Session detail and fee.
- Check-ins with queue, payment, and session rating fields.
- Player profiles (`displayName`, `phone`, `gender`, `defaultSkillRating`, `notes`).
- Session W-L-D per player when drawer opens.
- Local player/check-in changes and sync status.

## Component Composition

- `PlayerCheckInPanel`
- `QueuePanel`
- `PlayerRow` (`queue` variant)
- `PlayerDetailDrawer`
- `OfflineBanner`
- `SyncStatusBadge`

## Player Row Behavior

Each `PlayerRow` in the list shows read-only operational metadata:

- Display name (tap target)
- Queue status, wait time, matches played (session)
- Session skill rating (read-only on row)
- `PaymentBadge`
- `SyncStatusBadge` when pending

Row interactions:

| Interaction | Behavior |
|-------------|----------|
| Tap name or row body | Open `PlayerDetailDrawer` (`onOpenPlayerDetails`) |
| Overflow menu | Queue quick actions: `Mark resting`, `Back to waiting`, `Mark done`, `Remove from session`, `Restore` (context-dependent) |
| Payment badge tap | Open `PlayerDetailDrawer` (focus payment section if supported) |

Do not show inline `FormField` editors on the row for profile or session rating.

## Primary Actions

- Check in returning player (`PlayerCheckInPanel`).
- Create walk-in and check in (`PlayerCheckInPanel`).
- Open `PlayerDetailDrawer` to edit profile or session fields.
- Queue quick actions from row overflow menu.

## Secondary Actions

- Search within `QueuePanel`.
- Return to dashboard.

## Page States

- Loading players.
- No checked-in players.
- Players ready.
- Search no results.
- Drawer open (editing).
- Update error (preserve drawer form values).
- Offline with local player/check-in edits.
- Pending player/check-in sync.
- Failed sync for a player action.

## Session Mode

See `docs/specs/mvp-access.md`.

- Live session: check-in, drawer edits, and queue actions enabled.
- `completed` or `cancelled`: read-only list; drawer read-only; hide check-in and mutations.

## Responsive Layout

- **Mobile**: check-in panel collapsible or top; queue tabs; full-width rows; drawer as bottom sheet.
- **Tablet**: check-in beside or above queue tabs.
- **Desktop**: wider list; drawer as right overlay; dashboard context not required on this page.

## Navigation

- Return to `/organizer/sessions/:sessionId/dashboard`.

## API Endpoints

- `GET /api/v1/sessions/:sessionId/check-ins`
- `POST /api/v1/sessions/:sessionId/check-ins`
- `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId`
- `PATCH /api/v1/sessions/:sessionId/check-ins/:checkInId/payment`
- `POST /api/v1/sessions/:sessionId/check-ins/:checkInId/remove`
- `POST /api/v1/sessions/:sessionId/check-ins/:checkInId/restore`
- `GET /api/v1/players`
- `POST /api/v1/players`
- `PATCH /api/v1/players/:playerProfileId`
- `POST /api/v1/sync/actions` — `UPDATE_PLAYER_PROFILE`, check-in, payment, queue actions

## Acceptance Criteria

- Profile fields (name, phone, gender, club rating, notes) are editable only in `PlayerDetailDrawer`.
- Session rating and payment are editable in the drawer; initial values may be set at check-in only.
- List rows do not contain inline profile or rating form fields.
- Tapping a player opens the drawer with both **This session** and **Player profile** sections.
- Queue overflow actions work without opening the drawer when appropriate.
- Duplicate active check-ins are prevented.
- Payment and queue status are visible on each row.
- Long lists remain usable on mobile.
- Player self-service check-in is not part of MVP v1.
- Add, edit, and check-in actions save locally first and sync later.
