# Organizer Component Spec

## Organizer UX Goal

The organizer should be able to run a badminton session from one dashboard with minimal typing and clear status at a glance.

## Main Dashboard Composition

The live dashboard should be composed from these feature components:

- `SessionHeader`
- `SessionStatusBar`
- `CourtBoard`
- `QueuePanel`
- `SuggestedMatchPanel`
- `ActiveMatchPanel`
- `PaymentSummaryPanel`
- `PlayerCheckInPanel`
- `RecentMatchesPanel`
- `LeaderboardView` from organizer navigation or dashboard link.

Detailed feature specs live in `docs/specs/frontend/features/organizer/`. Use this file as the overview and the focused feature files as the implementation contracts.

MVP player operations are organizer-managed. Do not implement player self-service check-in or player-owned profile pages for v1.

## Components

### SessionHeader

Purpose:

- Show session name, venue, date/time, and high-level actions.

Props:

- `session`
- `onEditSession`
- `onCompleteSession`

Rules:

- Completing a session requires confirmation.
- Cancelled or completed sessions should become mostly read-only.

### SessionStatusBar

Purpose:

- Show key operating metrics.

Metrics:

- Checked-in players.
- Waiting players.
- Active matches.
- Open courts.
- Unpaid players.
- Collected amount.

Rules:

- Use compact cards on tablet and horizontal scroll on mobile if needed.
- Do not hide unpaid count.

### CourtBoard

Purpose:

- Show all session courts and current match state.

Court card states:

- `open`
- `occupied`
- `paused`
- `unavailable`

Actions:

- Assign match.
- Start match.
- Finish match.
- Pause court.
- Reopen court.

Rules:

- Occupied courts must show players by team.
- Paused or unavailable courts must not receive auto-suggested matches.

### QueuePanel

Purpose:

- Show waiting, resting, done, and removed players.

Player row data:

- Display name.
- Session rating.
- Queue status.
- Wait time.
- Matches played.
- Payment status.

Actions:

- Edit player session rating.
- Mark resting.
- Mark done.
- Remove from session.
- Bring back to waiting.

Rules:

- Payment status should be visible inline.
- Long-waiting players should be visually easy to identify.

### SuggestedMatchPanel

Purpose:

- Present the best next doubles match suggestion.

Data:

- Team one players.
- Team two players.
- Team average ratings.
- Score explanation.
- Warnings such as unpaid player or repeat partner.

Actions:

- Accept suggestion.
- Regenerate.
- Swap player.
- Swap teams.
- Manually assign.

Rules:

- Always explain why the suggestion was chosen in plain language.
- Accepting a suggestion should require choosing an open court if multiple courts are open.

### ActiveMatchPanel

Purpose:

- Support match operations from assignment through result recording.

Actions:

- Start match.
- Record score.
- Mark winner without score.
- Cancel match.
- Complete match.

Rules:

- Cancelling a match should not update ratings.
- Completing a scored match should show the rating impact if available.

### PaymentSummaryPanel

Purpose:

- Let organizers quickly track collection status.

Data:

- Expected total.
- Collected total.
- Unpaid total.
- Waived total.
- Count by payment status.

Actions:

- Filter unpaid players.
- Open payments view.

Rules:

- Do not mix manual payment tracking with online payment wording.

### PlayerCheckInPanel

Purpose:

- Add walk-ins and returning players during a session.

Actions:

- Search existing player.
- Create player.
- Check in player.
- Set session rating.
- Set payment status.

Rules:

- Returning players should be check-in-able in a few taps.
- New players should default to rating `3.0`.

### RecentMatchesPanel

Purpose:

- Show recently completed matches for context and correction.

Actions:

- View match detail.
- Correct result if allowed.

Rules:

- Result correction should be restricted to organizers.
- Correcting a result must recalculate rating history when implemented.

## Responsive Behavior

Tablet:

- Use a multi-column dashboard.
- Keep court board and suggested match visible above the fold.

Mobile:

- Use tabs or stacked sections.
- Prioritize quick actions: check in, mark paid, accept suggestion, finish match.

Desktop:

- Allow wider dashboard with payments and recent matches visible simultaneously.
