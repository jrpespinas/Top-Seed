# PlayerCheckInPanel

## User Job

Let the organizer add returning players or walk-ins to the current session quickly.

MVP v1 check-in is organizer-managed only. Players do not self-check-in from a QR or shared link.

Profile fields beyond the minimum are edited later in `PlayerDetailDrawer` — not in the check-in list row.

## Data Required

- Session id and fee.
- Player search results.
- Default rating (`3.0` for new profiles).
- Existing active check-ins for duplicate prevention.
- Local player/check-in sync status.

## Check-In Form Fields

### Returning player (search result → check in)

- **Session skill rating** — optional; defaults to player's `defaultSkillRating` or `3.0`.
- **Initial payment status** — optional; defaults to `unpaid`.

No other fields required to check in.

### New walk-in (`onCreatePlayer` + check in)

| Field | Required | Notes |
|-------|----------|-------|
| `displayName` | Yes | Only required profile field at create |
| `phone` | No | May add in drawer later |
| Session skill rating | No | Defaults to `3.0` or copied from club rating after save |
| Initial payment status | No | Defaults to `unpaid` |

**Not in check-in form (drawer only):** `gender`, organizer `notes`, club rating edits beyond create default.

After walk-in is created and checked in, organizer can open `PlayerDetailDrawer` to set gender, notes, or adjust club rating.

## Child Components

- `SearchInput`
- `PlayerRow` (`search` variant)
- `FormField`
- `Select`
- `Button`
- `Drawer`
- `PaymentBadge`
- `SyncStatusBadge`

## Actions Emitted

- `onSearchPlayer`
- `onCreatePlayer` — minimal profile: `displayName`, optional `phone`
- `onCheckInPlayer` — optional initial `sessionSkillRating`, `paymentStatus`
- `onOpenPlayerDetails` — optional after create; opens drawer for remaining profile fields

## Session Mode

MVP v1 has no login or role checks. See `docs/specs/mvp-access.md`.

## States

- Search empty.
- Searching.
- Returning player results.
- No results.
- Creating walk-in.
- Checking in.
- Duplicate already checked-in warning.
- Error.
- Offline with local player or check-in pending sync.

## Responsive Composition

- Mobile: drawer or full-width form.
- Tablet: panel can stay open beside queue.
- Desktop: search and quick-add can show together.

## Acceptance Criteria

- Returning players can be checked in in a few taps.
- New walk-ins require only a display name at create; gender is not required.
- New players default session rating to `3.0` unless organizer sets otherwise at check-in.
- Duplicate check-ins are blocked and explained.
- Gender, notes, and full profile edits happen in `PlayerDetailDrawer`, not in the walk-in form.
- No player-facing check-in controls are required for MVP v1.
- Player creation and check-in write locally first and remain available after reload.
